const User = require('../models/User');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// 🚨 Nodemailer हटा दिया है! अब हम सीधा API (fetch) का यूज़ करेंगे।

// 1. Signup और असली OTP भेजना (Via Brevo API)
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
        console.log("✅ User saved to DB. Calling Brevo API...");

        // 🚨 Render SMTP Bypass - सीधा HTTPS API कॉल!
        try {
            const response = await fetch('https://api.brevo.com/v3/smtp/email', {
                method: 'POST',
                headers: {
                    'accept': 'application/json',
                    'api-key': process.env.BREVO_API_KEY, // Render से API Key लेगा
                    'content-type': 'application/json'
                },
                body: JSON.stringify({
                    sender: { name: 'Chodu Cid Chat', email: 'harikrdbg121@gmail.com' }, // यहाँ कोई भी ईमेल डाल सकते हो
                    to: [{ email: email }],
                    subject: 'Your Security Access Code (OTP)',
                    htmlContent: `
                        <div style="font-family: Arial, sans-serif; padding: 20px; text-align: center;">
                            <h2 style="color: #4F46E5;">Welcome to Chodu Cid Chat!</h2>
                            <p>Your secure access code (OTP) is:</p>
                            <h1 style="background: #1E293B; color: #10B981; padding: 10px; letter-spacing: 5px; border-radius: 10px; display: inline-block;">
                                ${otp}
                            </h1>
                            <p style="color: #64748B; font-size: 12px; margin-top: 20px;">This code is valid for 10 minutes.</p>
                        </div>
                    `
                })
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(JSON.stringify(errData));
            }

            console.log("📧 Real OTP Email Sent Successfully via API!");
            return res.status(200).json({ message: 'OTP sent to your email. Please check your inbox.' });
            
        } catch (apiError) {
            console.error("❌ Email API Error:", apiError);
            return res.status(500).json({ 
                message: 'Failed to send OTP email via API.', 
                error: apiError.message 
            });
        }

    } catch (error) {
        console.error("❌ Signup Error:", error);
        res.status(500).json({ message: 'Server error', error: error.message });
    }
};

// 2. OTP Verify करना (इसमें कोई बदलाव नहीं)
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

// 3. Login (इसमें कोई बदलाव नहीं)
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