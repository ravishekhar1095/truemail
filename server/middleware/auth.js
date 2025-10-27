const jwt = require('jsonwebtoken');
const User = require('../models/user');
const config = require('../config/config');

exports.protect = async (req, res, next) => {
    try {
        const auth = req.headers.authorization;
        
        if (!auth?.startsWith('Bearer ')) {
            return res.status(401).json({ 
                success: false, 
                error: 'Authorization token required' 
            });
        }

        const token = auth.split(' ')[1];
        
        const decoded = jwt.verify(token, config.JWT_SECRET);
        
        const user = await User.findById(decoded.userId)
            .select('-passwordHash');
            
        if (!user) {
            return res.status(401).json({
                success: false,
                error: 'User not found'
            });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({
            success: false,
            error: 'Not authorized'
        });
    }
};

exports.checkCredits = async (req, res, next) => {
    try {
        const cost = req.creditCost || 1;
        
        if (req.user.credits_left < cost) {
            return res.status(402).json({
                success: false,
                error: 'Insufficient credits'
            });
        }
        
        next();
    } catch (error) {
        return res.status(500).json({
            success: false,
            error: 'Error checking credits'
        });
    }
};

exports.rateLimiter = require('express-rate-limit')({
    windowMs: config.RATE_LIMIT.windowMs,
    max: config.RATE_LIMIT.max,
    message: {
        success: false,
        error: 'Too many requests, please try again later'
    }
});