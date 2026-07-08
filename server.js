const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const nodemailer = require('nodemailer');

// Környezeti változók betöltése (.env fájlból)
require('dotenv').config(); 

const app = express();
const PORT = process.env.PORT || 10000;

// Proxy mögötti valós IP-k kezelése a rate limiterhez
app.set('trust proxy', 1);

// CORS konfiguráció a környezeti változóból (beolvassa a localhostot és a null-t is)
const allowedOrigins = process.env.ALLOWED_ORIGINS 
    ? process.env.ALLOWED_ORIGINS.split(',') 
    : ['http://localhost:5500', 'http://127.0.0.1:5500', 'https://szeppiy.github.io', 'null'];

app.use(cors({
    origin: function (origin, callback) {
        if (!origin || origin === 'null' || allowedOrigins.includes(origin)) {
            callback(null, true);
        } else {
            console.error(`[CORS BLOKKOLÁS] Tiltott origin próbálkozott: ${origin}`);
            callback(new Error('A CORS házirend nem engedélyezi ezt a forrást.'));
        }
    },
    credentials: true,
    methods: ['POST', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization']
}));

app.use(express.json());

// Kéréskorlátozás (Rate Limit) helyi tesztekhez (15 percenként max 50 kérés)
const apiLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, 
    max: 50,
    standardHeaders: true,
    legacyHeaders: false,
    handler: (req, res) => {
        console.warn(`=== [RATE LIMIT] TÚLLÉPÉS === | IP: ${req.ip}`);
        res.status(429).json({
            error: 'Túl sok kérés rövid időn belül. Kérjük, próbáld újra később.'
        });
    }
});

// ==========================================
// 1. NODEMAILER BEÁLLÍTÁS (Közvetlen Gmail SMTP)
// ==========================================
const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS  
    }
});

// ==========================================
// 2. EXPRESS VALIDÁTOR SZABÁLYOK
// ==========================================
const orderValidationRules = [
    body('customer.name').trim().notEmpty().withMessage('A név megadása kötelező.'),
    body('customer.phone').trim().notEmpty().withMessage('A telefonszám megadása kötelező.'),
    body('delivery.type').isIn(['pickup', 'delivery']).withMessage('Érvénytelen szállítási mód.'),
    body('items').isArray({ min: 1 }).withMessage('A kosár nem lehet üres.'),
    body('total').isNumeric().withMessage('A végösszeg hibás formátumú.')
];

// ==========================================
// 3. FŐ VÉGPONT: RENDELÉSEK FELDOLGOZÁSA
// ==========================================
app.post('/api/orders', apiLimiter, orderValidationRules, async (req, res) => {
    
    console.log("\n=============================================");
    console.log("===      ÚJ RENDELÉS ÉRKEZETT (LOKÁL)     ===");
    console.log("=============================================");
    console.log(`[Időpont] ${new Date().toISOString()}`);
    console.log(`[Payload]\n`, JSON.stringify(req.body, null, 2));
    console.log("---------------------------------------------");

    // Validációs hibák ellenőrzése
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        console.error("=== VALIDÁCIÓS HIBÁK DETEKTÁLVA ===");
        console.error(JSON.stringify(errors.array(), null, 2));
        return res.status(400).json({
            error: 'Hibás vagy hiányzó adatok a rendelésben.',
            details: errors.array()
        });
    }

    const { customer, delivery, notes, items, total } = req.body;

    try {
        // --- E-MAIL TARTALOM ÖSSZEÁLLÍTÁSA ---
        let deliveryHtml = delivery.type === 'pickup'
            ? `<p><strong>Átvétel módja:</strong> Személyes átvétel Piacon<br><strong>Választott piac:</strong> ${delivery.details.market}</p>`
            : `<p><strong>Átvétel módja:</strong> Házhozszállítás<br><strong>Cím:</strong> ${delivery.details.city}, ${delivery.details.street}</p>`;

        const itemsHtml = items.map(item => {
            const itemPrice = item.unit === 'doboz' ? item.price : (item.price / 10);
            const itemTotal = Math.round(itemPrice * item.quantity);
            const unitText = item.unit === 'doboz' ? 'db' : 'dkg';
            return `<li><strong>${item.name}</strong> - ${item.quantity} ${unitText} <i>(kb. ${itemTotal} Ft)</i></li>`;
        }).join('');

        const mailOptions = {
            from: `"JanCheese Rendszer" <${process.env.EMAIL_USER}>`,
            to: process.env.ADMIN_EMAIL || process.env.EMAIL_USER, 
            ...(customer.email && { replyTo: customer.email }), 
            subject: `🧀 ÚJ RENDELÉS: ${customer.name} - ${total} Ft`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: auto; padding: 20px; border: 1px solid #eee; border-radius: 10px;">
                    <h2 style="color: #d97706; border-bottom: 2px solid #f59e0b; padding-bottom: 10px;">Új JanCheese Rendelés!</h2>
                    <h3>Vevő Adatai</h3>
                    <p><strong>Név:</strong> ${customer.name}</p>
                    <p><strong>Telefon:</strong> ${customer.phone}</p>
                    ${notes ? `<p><strong>Megjegyzés:</strong> ${notes}</p>` : ''}
                    <h3>Szállítási Adatok</h3>
                    <div style="background: #f9fafb; padding: 10px; border-radius: 5px;">${deliveryHtml}</div>
                    <h3>Rendelt Tételek</h3>
                    <ul>${itemsHtml}</ul>
                    <div style="margin-top: 30px; padding-top: 15px; border-top: 2px dashed #ccc; text-align: right;">
                        <h2>Várható Végösszeg: <span style="color: #d97706;">${total} Ft</span></h2>
                    </div>
                </div>
            `
        };

        // --- 1. AZONNALI SIKER VÁLASZ A FRONTENDNEK ---
        // A frontend gombja azonnal leáll, és zöldre vált, nincs pörgés!
        res.status(200).json({ 
            success: true, 
            message: 'A rendelést a lokális szerver sikeresen rögzítette!' 
        });

        // --- 2. LEVÉL KÜLDÉSE A HÁTTÉRBEN ---
        // Nincs előtte 'await', így nem tartja vissza a frontendet
        console.log("[INFO] E-mail küldése az SMTP szerveren keresztül...");
        transporter.sendMail(mailOptions)
            .then(() => console.log("=== [SIKER] E-MAIL SIKERESEN KIKÜLDVE! ===\n"))
            .catch((mailErr) => console.error("[-] Lokális e-mail küldési hiba:", mailErr.message));

    } catch (error) {
        console.error("\n=== [VÉGZETES HIBA] LOKÁLIS FELDOLGOZÁS KÖZBEN ===");
        console.error(error);
        res.status(500).json({ error: 'Szerverhiba történt a lokális feldolgozáskor.' });
    }
});

// Szerver indítása lokális porton
app.listen(PORT, () => {
    console.log(`\n🚀 [START] UNAS-mentes tiszta szerver elindult helyben a http://localhost:${PORT} címen.`);
});