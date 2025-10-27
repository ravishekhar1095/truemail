const express = require('express');
const router = express.Router();

// Admin middleware
function isAdmin(req, res, next) {
    if (req.user && req.user.role === 'admin') {
        next();
    } else {
        res.status(403).json({ error: 'Unauthorized' });
    }
}

// Get all users
router.get('/users', isAdmin, async (req, res) => {
    try {
        const [users] = await req.db.query(
            'SELECT id, name, email, credits, active FROM users'
        );
        res.json(users);
    } catch (error) {
        console.error('Error fetching users:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Get usage statistics
router.get('/stats', isAdmin, async (req, res) => {
    try {
        // Get total users
        const [[{ totalUsers }]] = await req.db.query(
            'SELECT COUNT(*) as totalUsers FROM users'
        );

        // Get active users today
        const [[{ activeToday }]] = await req.db.query(
            'SELECT COUNT(DISTINCT user_id) as activeToday FROM activity_log WHERE DATE(timestamp) = CURDATE()'
        );

        // Get total emails found
        const [[{ emailsFound }]] = await req.db.query(
            'SELECT COUNT(*) as emailsFound FROM activity_log WHERE action = "generate_email"'
        );

        // Get total verifications
        const [[{ verifications }]] = await req.db.query(
            'SELECT COUNT(*) as verifications FROM activity_log WHERE action = "verify_email"'
        );

        res.json({
            totalUsers,
            activeToday,
            emailsFound,
            verifications
        });
    } catch (error) {
        console.error('Error fetching stats:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Modify user credits
router.post('/users/:userId/credits', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { amount } = req.body;

    if (!amount || isNaN(amount)) {
        return res.status(400).json({ error: 'Invalid amount' });
    }

    try {
        await req.db.query(
            'UPDATE users SET credits = credits + ? WHERE id = ?',
            [amount, userId]
        );

        // Log the credit modification
        await req.db.query(
            'INSERT INTO activity_log (user_id, action, details) VALUES (?, "modify_credits", ?)',
            [userId, JSON.stringify({ amount, admin_id: req.user.id })]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error modifying credits:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// Toggle user status
router.post('/users/:userId/status', isAdmin, async (req, res) => {
    const { userId } = req.params;
    const { active } = req.body;

    if (typeof active !== 'boolean') {
        return res.status(400).json({ error: 'Invalid status' });
    }

    try {
        await req.db.query(
            'UPDATE users SET active = ? WHERE id = ?',
            [active, userId]
        );

        // Log the status change
        await req.db.query(
            'INSERT INTO activity_log (user_id, action, details) VALUES (?, "status_change", ?)',
            [userId, JSON.stringify({ active, admin_id: req.user.id })]
        );

        res.json({ success: true });
    } catch (error) {
        console.error('Error updating user status:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;