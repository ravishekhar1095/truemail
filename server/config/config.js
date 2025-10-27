require('dotenv').config();

module.exports = {
    // Server Configuration
    PORT: process.env.PORT || 3000,
    NODE_ENV: process.env.NODE_ENV || 'development',
    
    // Database Configuration
    MONGODB_URI: process.env.MONGODB_URI || 'mongodb://localhost:27017/email_finder',
    
    // Authentication
    JWT_SECRET: process.env.JWT_SECRET || 'please_change_this_secret',
    JWT_EXPIRE: process.env.JWT_EXPIRE || '7d',
    
    // Credits and Plans
    PLANS: {
        free: {
            credits: 5,
            features: ['basic_search', 'email_verify']
        },
        starter: {
            credits: 20,
            features: ['basic_search', 'email_verify', 'advanced_patterns']
        },
        pro: {
            credits: 100,
            features: ['basic_search', 'email_verify', 'advanced_patterns', 'bulk_search', 'api_access']
        },
        enterprise: {
            credits: 'unlimited',
            features: ['basic_search', 'email_verify', 'advanced_patterns', 'bulk_search', 'api_access', 'dedicated_support']
        }
    },
    
    // Email Pattern Generation
    EMAIL_PATTERNS: {
        basic: [
            '{f}.{l}',
            '{f}{l}',
            '{l}.{f}',
            '{l}{f}',
            '{f}',
            '{l}',
            '{fi}{l}',
            '{f}{li}'
        ],
        advanced: [
            '{f}.{l}',
            '{f}{l}',
            '{l}.{f}',
            '{l}{f}',
            '{f}_{l}',
            '{l}_{f}',
            '{fi}{l}',
            '{f}{li}',
            '{fi}.{l}',
            '{f}.{li}',
            '{fi}_{l}',
            '{f}_{li}'
        ]
    },
    
    // Rate Limiting
    RATE_LIMIT: {
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100 // limit each IP to 100 requests per windowMs
    }
};