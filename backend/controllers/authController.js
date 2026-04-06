const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');

// 🚨 Nodemailer Transporter Setup (Render IPv6 Bug & Anti-Buffering Fix)
const transporter = nodemailer.createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false, 
    auth: {
        // .trim() गलती से आए स्पेस को हटा देगा
        user: process.env.EMAIL_USER?.trim(),
        pass: process.env.EMAIL_PASS?.trim()
    },
    tls: {
        rejectUnauthorized: false
    },
    // Render पर IPv6 ब्लॉक होने की समस्या (ENETUNREACH) का पक्का इलाज:
    family: 4, 
    // 10 सेकंड का टाइमआउट ताकि ऐप 'बफ़रिंग' में न फँसे:
    connectionTimeout: 10000, 
    greetingTimeout: 10000,
    socketTimeout: 10000
});

// 1. Signup और असली OTP भेजना
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
        console.log("✅ User saved to DB. Sending REAL email now...");

        const mailOptions = {
            from: `"Chodu Cid Chat" <${process.env.EMAIL_USER}>`,
            to: email,
            subject: 'Your Security Access Code (OTP)',
            html: `
                <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                    <h2 style="color: #4F46E5;">Welcome to Chodu Cid Chat!</h2>
                    <p>Your secure access code (OTP) is:</p>
                    <h1 style="background: #1E293B; color: #10B981; padding: 10px; letter-spacing: 5px; border-radius: 10px; display: inline-block;">
                        ${otp}
                    </h1>
                    <p style="color: #64748B; font-size: 12px; margin-top: 20px;">This code is valid for 10 minutes.</p>
                </div>
            `
        };

        // ईमेल भेजने के लिए अलग try-catch
        try {
            await transporter.sendMail(mailOptions);
            console.log("📧 Real OTP Email Sent Successfully!");
            return res.status(200).json({ message: 'OTP sent to your email. Please check your inbox.' });
            
        } catch (mailError) {
            console.error("❌ Nodemailer Error:", mailError);
            return res.status(500).json({ 
                message: 'Failed to send OTP email. Please try again.', 
                error: mailError.message 
            });
        }

    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// 2. OTP Verify करना
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

// 3. Login 
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