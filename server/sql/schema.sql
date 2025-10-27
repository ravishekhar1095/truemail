-- Users table (already exists, but adding for reference)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(191) NOT NULL UNIQUE,
    password VARCHAR(191) NOT NULL,
    first_name VARCHAR(191),
    last_name VARCHAR(191),
    email VARCHAR(191) NOT NULL UNIQUE,
    credits_left INT DEFAULT 5,
    credits_used INT DEFAULT 0,
    account_status ENUM('active', 'suspended', 'deleted') DEFAULT 'active',
    role ENUM('user', 'admin') DEFAULT 'user',
    plan ENUM('free', 'starter', 'pro', 'enterprise') DEFAULT 'free',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(email),
    INDEX(username)
);

-- Transactions table (already exists, but adding for reference)
CREATE TABLE IF NOT EXISTS transactions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    delta INT NOT NULL,
    reason VARCHAR(191),
    date DATETIME DEFAULT CURRENT_TIMESTAMP,
    credits INT,
    INDEX(user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Email Operations History
CREATE TABLE IF NOT EXISTS email_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    operation_type ENUM('generate', 'verify') NOT NULL,
    input_data JSON NOT NULL,
    results JSON NOT NULL,
    credits_used INT DEFAULT 1,
    success BOOLEAN DEFAULT true,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    INDEX(user_id),
    INDEX(operation_type),
    INDEX(created_at),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- Plans
CREATE TABLE IF NOT EXISTS plans (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name ENUM('free', 'starter', 'pro', 'enterprise') NOT NULL UNIQUE,
    monthly_credits INT NOT NULL,
    price_monthly DECIMAL(10,2),
    features JSON NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- Subscriptions
CREATE TABLE IF NOT EXISTS subscriptions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    plan_id INT NOT NULL,
    status ENUM('active', 'cancelled', 'expired') DEFAULT 'active',
    start_date DATETIME NOT NULL,
    end_date DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX(user_id),
    INDEX(plan_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (plan_id) REFERENCES plans(id) ON DELETE RESTRICT
);

-- Insert default plans
INSERT IGNORE INTO plans (name, monthly_credits, price_monthly, features) VALUES
('free', 5, 0.00, '{"features": ["basic_search", "email_verify"]}'),
('starter', 20, 9.99, '{"features": ["basic_search", "email_verify", "advanced_patterns"]}'),
('pro', 100, 29.99, '{"features": ["basic_search", "email_verify", "advanced_patterns", "bulk_search", "api_access"]}'),
('enterprise', 999999, 299.99, '{"features": ["basic_search", "email_verify", "advanced_patterns", "bulk_search", "api_access", "dedicated_support"]}');