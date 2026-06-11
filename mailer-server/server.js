require('dotenv').config();

const express = require('express');
const cors = require('cors');
const nodemailer = require('nodemailer');

const { initializeApp, cert } = require('firebase-admin/app');
const { getFirestore, FieldValue } = require('firebase-admin/firestore');
const { getAuth } = require('firebase-admin/auth');

const serviceAccount = require('./serviceAccountKey.json');

initializeApp({
  credential: cert(serviceAccount),
});

const db = getFirestore();

const app = express();

app.use(
  cors({
    origin: ['http://localhost:5173', 'http://localhost:5174'],
  })
);

app.use(express.json());

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: Number(process.env.SMTP_PORT),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

function generateTemporaryPassword() {
  const chars =
    'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789!@#$%';
  let password = 'BWS-';

  for (let i = 0; i < 10; i += 1) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  return password;
}

function acceptedEmailHtml({ fullName, email, password, loginUrl }) {
  return `
<!DOCTYPE html>
<html lang="ar" dir="rtl">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>تم قبول طلبك</title>
  </head>

  <body style="margin:0; padding:0; background:#F5FAFF; font-family:Arial, Tahoma, sans-serif; color:#07111F;">
    <table width="100%" cellpadding="0" cellspacing="0" style="background:#F5FAFF; padding:40px 16px;">
      <tr>
        <td align="center">
          <table width="100%" cellpadding="0" cellspacing="0" style="max-width:620px; background:#ffffff; border-radius:24px; overflow:hidden; box-shadow:0 20px 60px rgba(30,52,120,0.14);">

            <tr>
              <td style="background:linear-gradient(135deg,#1E3478,#07111F); padding:34px 28px; text-align:center;">
                <div style="display:inline-block; background:rgba(255,255,255,0.10); border-radius:18px; padding:12px 18px; color:#13D7C6; font-weight:800; letter-spacing:1px;">
                  BAWSALA PORTAL
                </div>

                <h1 style="margin:22px 0 0; color:#ffffff; font-size:28px; line-height:1.5;">
                  تم قبول طلبك بنجاح
                </h1>

                <p style="margin:10px 0 0; color:rgba(255,255,255,0.72); font-size:15px; line-height:1.8;">
                  يمكنك الآن الدخول إلى لوحة التحكم الخاصة بك ومتابعة خدماتك وفواتيرك.
                </p>
              </td>
            </tr>

            <tr>
              <td style="padding:32px 28px;">
                <p style="margin:0 0 16px; font-size:16px; line-height:1.9;">
                  مرحباً <strong>${fullName}</strong>،
                </p>

                <p style="margin:0 0 24px; font-size:15px; line-height:1.9; color:#475569;">
                  يسعدنا إعلامك بأنه تمت الموافقة على طلب إنشاء حسابك في منصة بوصلة. استعمل البيانات التالية لتسجيل الدخول:
                </p>

                <table width="100%" cellpadding="0" cellspacing="0" style="background:#F8FBFF; border:1px solid #E2E8F0; border-radius:18px; overflow:hidden;">
                  <tr>
                    <td style="padding:18px 20px; border-bottom:1px solid #E2E8F0;">
                      <p style="margin:0 0 6px; color:#64748B; font-size:13px; font-weight:700;">
                        البريد الإلكتروني
                      </p>
                      <p style="margin:0; color:#1E3478; font-size:16px; font-weight:800; direction:ltr; text-align:right;">
                        ${email}
                      </p>
                    </td>
                  </tr>

                  <tr>
                    <td style="padding:18px 20px;">
                      <p style="margin:0 0 6px; color:#64748B; font-size:13px; font-weight:700;">
                        كلمة المرور المؤقتة
                      </p>
                      <p style="margin:0; color:#1E3478; font-size:20px; font-weight:900; letter-spacing:1px; direction:ltr; text-align:right;">
                        ${password}
                      </p>
                    </td>
                  </tr>
                </table>

                <div style="text-align:center; margin:30px 0;">
                  <a href="${loginUrl}" style="display:inline-block; background:#1E3478; color:#ffffff; text-decoration:none; padding:15px 30px; border-radius:16px; font-size:15px; font-weight:900;">
                    الدخول إلى لوحة التحكم
                  </a>
                </div>

                <div style="background:#ECFEFF; border:1px solid rgba(19,215,198,0.35); border-radius:18px; padding:16px 18px;">
                  <p style="margin:0; color:#0F766E; font-size:14px; line-height:1.8; font-weight:700;">
                    ملاحظة أمنية: هذه كلمة مرور مؤقتة. ننصحك بتغييرها بعد أول تسجيل دخول.
                  </p>
                </div>

                <p style="margin:28px 0 0; font-size:15px; line-height:1.9; color:#475569;">
                  إذا احتجت أي مساعدة، يمكنك الرد على هذا البريد مباشرة.
                </p>

                <p style="margin:24px 0 0; font-size:15px; line-height:1.9; color:#07111F; font-weight:800;">
                  فريق بوصلة
                </p>
              </td>
            </tr>

            <tr>
              <td style="background:#F8FBFF; padding:18px 28px; text-align:center; border-top:1px solid #E2E8F0;">
                <p style="margin:0; color:#94A3B8; font-size:12px; line-height:1.7;">
                  © ${new Date().getFullYear()} Bawsala. جميع الحقوق محفوظة.
                </p>
              </td>
            </tr>

          </table>
        </td>
      </tr>
    </table>
  </body>
</html>
`;
}

app.post('/accept-request', async (req, res) => {
  try {
    const secret = req.headers['x-mailer-secret'];

    if (secret !== process.env.MAILER_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { requestId, companyName, fullName, email, phone } = req.body;

    if (!requestId || !companyName || !fullName || !email) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    const requestRef = db.collection('accessRequests').doc(requestId);
    const requestSnap = await requestRef.get();

    if (!requestSnap.exists) {
      return res.status(404).json({ error: 'Request not found' });
    }

    const requestData = requestSnap.data();

    if (requestData.status === 'accepted') {
      return res.status(400).json({ error: 'Request already accepted' });
    }

    const temporaryPassword = generateTemporaryPassword();

    let userRecord;

    try {
      userRecord = await getAuth().createUser({
  email,
  password: temporaryPassword,
  displayName: fullName,
});
    } catch (error) {
      if (error.code === 'auth/email-already-exists') {
  return res.status(400).json({
    code: 'EMAIL_ALREADY_EXISTS',
    error: 'This email already has an account',
  });
}

      throw error;
    }

    await db.collection('users').doc(userRecord.uid).set({
      uid: userRecord.uid,
      role: 'client',
      companyName,
      fullName,
      email,
      phone: phone || '',
      status: 'active',
      mustChangePassword: true,
      createdFromRequestId: requestId,
      createdAt: FieldValue.serverTimestamp(),
    });

    await requestRef.update({
      status: 'accepted',
      acceptedAt: FieldValue.serverTimestamp(),
      clientUid: userRecord.uid,
    });

    const loginUrl = process.env.CLIENT_LOGIN_URL || 'http://localhost:5173/login';

    await transporter.sendMail({
      from: `"Bawsala Portal" <${process.env.FROM_EMAIL}>`,
      to: email,
      subject: 'تم قبول طلبك في منصة بوصلة',
      html: acceptedEmailHtml({
        fullName,
        email,
        password: temporaryPassword,
        loginUrl,
      }),
    });

    return res.json({
      ok: true,
      uid: userRecord.uid,
    });
  } catch (error) {
    console.error('Accept request failed:', error);
    return res.status(500).json({
      error: 'Accept request failed',
    });
  }
});

app.post('/send-email', async (req, res) => {
  try {
    const secret = req.headers['x-mailer-secret'];

    if (secret !== process.env.MAILER_SECRET) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const { to, subject, html } = req.body;

    if (!to || !subject || !html) {
      return res.status(400).json({ error: 'Missing fields' });
    }

    await transporter.sendMail({
      from: `"Bawsala Portal" <${process.env.FROM_EMAIL}>`,
      to,
      subject,
      html,
    });

    return res.json({ ok: true });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Email failed' });
  }
});

app.listen(process.env.PORT, () => {
  console.log(`Mailer server running on port ${process.env.PORT}`);
});