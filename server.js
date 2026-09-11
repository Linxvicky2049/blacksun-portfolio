// ====================================
// PORTFOLIO BACKEND SERVER
// ====================================

const express = require('express');
const cors = require('cors');
const dotenv = require('dotenv');
const nodemailer = require('nodemailer');
const path = require('path');

// Load environment variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

// ====================================
// MIDDLEWARE
// ====================================

app.use(express.static(path.join(__dirname, '.')));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

// ====================================
// NODEMAILER CONFIGURATION
// ====================================

const transporter = nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
        user: process.env.EMAIL_USER || 'victor4all2015@gmail.com',
        pass: process.env.EMAIL_PASSWORD || 'your_app_password_here'
    }
});

// ====================================
// ROUTES
// ====================================

// Serve main page
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'index.html'));
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({
        status: 'Server is running',
        timestamp: new Date(),
        portfolio: 'OKAFOR VICTOR SOMTO'
    });
});

// Get portfolio data
app.get('/api/portfolio', (req, res) => {
    const portfolioData = {
        name: 'OKAFOR VICTOR SOMTO',
        title: 'Full Stack Developer | Freelancer | Gamer | Streamer',
        company: 'BLACKSUN',
        email: 'victor4all2015@gmail.com',
        phones: ['08122911210', '07049861175'],
        education: {
            degree: 'B.Cs Physics',
            year: '2018-2023',
            university: 'Federal University of Petroleum Resources Effurun, Warri'
        },
        skills: {
            technical: [
                'Web Development',
                'Frontend (HTML, CSS, JavaScript)',
                'Backend (Node.js, Express, Python)',
                'Databases (MongoDB, SQL)',
                'UI/UX Design',
                'API Development'
            ],
            personal: [
                'Problem Solving',
                'Team Collaboration',
                'Communication',
                'Time Management',
                'Adaptability',
                'Leadership',
                'Creativity',
                'Attention to Detail'
            ]
        },
        hobbies: [
            'Gaming',
            'Streaming',
            'Freelancing',
            'Innovation'
        ],
        social: {
            github: 'https://github.com/Linxvicky2049',
            instagram: 'https://www.instagram.com',
            tiktok: 'https://www.tiktok.com',
            linkedin: 'https://www.linkedin.com',
            telegram: 'https://t.me'
        }
    };
    
    res.json(portfolioData);
});

// Contact form submission
app.post('/api/contact', async (req, res) => {
    try {
        const { name, email, subject, message } = req.body;

        // Validate input
        if (!name || !email || !subject || !message) {
            return res.status(400).json({ error: 'All fields are required' });
        }

        // Email validation
        const emailRegex = /^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/;
        if (!emailRegex.test(email)) {
            return res.status(400).json({ error: 'Invalid email address' });
        }

        // Email options
        const mailOptions = {
            from: process.env.EMAIL_USER || 'victor4all2015@gmail.com',
            to: 'victor4all2015@gmail.com',
            subject: `New Portfolio Contact: ${subject}`,
            html: `
                <div style="font-family: Arial, sans-serif; max-width: 600px;">
                    <h2 style="color: #00ff88;">New Portfolio Contact</h2>
                    <p><strong>Name:</strong> ${name}</p>
                    <p><strong>Email:</strong> ${email}</p>
                    <p><strong>Subject:</strong> ${subject}</p>
                    <div style="background-color: #f5f5f5; padding: 15px; border-left: 4px solid #00ff88;">
                        <p><strong>Message:</strong></p>
                        <p>${message.replace(/\\n/g, '<br>')}</p>
                    </div>
                    <hr>
                    <p style="color: #999; font-size: 12px;">This message was sent from your portfolio website</p>
                </div>
            `
        };

        // Send email
        await transporter.sendMail(mailOptions);

        // Send confirmation response
        res.json({
            success: true,
            message: 'Message sent successfully!',
            timestamp: new Date()
        });

    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).json({ 
            error: 'Failed to send message',
            details: error.message 
        });
    }
});

// Get contact info
app.get('/api/contact-info', (req, res) => {
    res.json({
        email: 'victor4all2015@gmail.com',
        phone1: '08122911210',
        phone2: '07049861175',
        company: 'BLACKSUN'
    });
});

// 404 Handler
app.use((req, res) => {
    res.status(404).json({
        error: 'Not found',
        path: req.url,
        message: 'The requested resource does not exist'
    });
});

// ====================================
// ERROR HANDLER
// ====================================

app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({
        error: 'Internal server error',
        message: process.env.NODE_ENV === 'development' ? err.message : 'Something went wrong'
    });
});

// ====================================
// SERVER STARTUP
// ====================================

app.listen(PORT, () => {
    console.log(`
    ╔═════════════════════════════════════╗
    ║  OKAFOR VICTOR SOMTO PORTFOLIO      ║
    ║  BLACKSUN                           ║
    ║                                     ║
    ║  Server running on port ${PORT}      ║
    ║  http://localhost:${PORT}            ║
    ╚═════════════════════════════════════╝
    `);
});

module.exports = app;