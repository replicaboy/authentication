const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 🚨 UPDATE: Nodemailer Transporter Setup (Render Cloud Fix)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // Port 465 के लिए true रखना ज़रूरी है
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS // 16-digit App Password 
    },
    tls: {
        // Render जैसे क्लाउड सर्वर पर कनेक्शन ब्लॉक (Timeout) होने से बचाने के लिए:
        rejectUnauthorized: false
    }
});

// Signup और OTP भेजना
exports.signup = async (req, res) => {
    const { email, password } = req.body;
    try {
        let user = await User.findOne({ email });
        if (user) return res.status(400).json({ message: 'User already exists' });

        const hashedPassword = await bcrypt.hash(password, 10);
        const otp = Math.floor(100000 + Math.random() * 900000).toString();

        user = new User({
            email,
            password: hashedPassword,
            otp,
            otpExpires: Date.now() + 10 * 60 * 1000 
        });

        await user.save();
        console.log("✅ User saved to DB. Sending email...");

        const mailOptions = {
            from: process.env.EMAIL_USER,
            to: email,
            subject: 'Your OTP for Registration - Chodu Cid Chat',
            text: `Your OTP is: ${otp}. It is valid for 10 minutes.`
        };

        // 🚨 ईमेल भेजने के लिए अलग try-catch ताकि "Buffering" न हो
        try {
            await transporter.sendMail(mailOptions);
            console.log("📧 OTP Email Sent Successfully");
            return res.status(200).json({ message: 'OTP sent to email. Please verify.' });
        } catch (mailError) {
            console.error("❌ Nodemailer Error:", mailError);
            // अगर ईमेल फेल हुआ, तो कम से कम रिस्पॉन्स भेज दो ताकि लोडिंग रुके
            return res.status(500).json({ 
                message: 'User created but OTP email failed. Please check your App Password.', 
                error: mailError.message 
            });
        }

    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// OTP Verify करना
exports.verifyOTP = async (req, res) => {
    try {
        const { email, otp } = req.body;
        const user = await User.findOne({ email });
        
        if (!user) {
            return res.status(400).json({ message: "User not found." });
        }

        if (String(user.otp) !== String(otp)) {
            return res.status(400).json({ message: "Invalid or expired OTP" });
        }

        user.isVerified = true; 
        user.otp = undefined; 
        await user.save();

        res.status(200).json({ message: "Email verified successfully!" });

    } catch (error) {
        res.status(500).json({ message: "Server error during verification" });
    }
};

// Login 
exports.login = async (req, res) => {
    const { email, password } = req.body;
    try {
        const user = await User.findOne({ email });
        if (!user) return res.status(400).json({ message: 'Invalid credentials' });
        
        if (!user.isVerified) {
            return res.status(400).json({ message: 'Please verify your email first' });
        }

        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

        const token = jwt.sign({ id: user._id }, process.env.JWT_SECRET, { expiresIn: '1h' });
        res.status(200).json({ token, message: 'Logged in successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Server error' });
    }
};