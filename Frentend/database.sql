-- StudyBin MySQL Database Schema Setup
-- Use this script to import tables into phpMyAdmin or MySQL console

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS = 0;

-- ----------------------------
-- Table structure for colleges
-- ----------------------------
CREATE TABLE IF NOT EXISTS `colleges` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL UNIQUE,
  `pincode` varchar(50) NOT NULL,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for users
-- ----------------------------
CREATE TABLE IF NOT EXISTS `users` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL UNIQUE,
  `password` varchar(255) NOT NULL,
  `college` varchar(255) NOT NULL,
  `role` varchar(50) DEFAULT 'student',
  `is_blocked` tinyint(1) DEFAULT '0',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for notes
-- ----------------------------
CREATE TABLE IF NOT EXISTS `notes` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `title` varchar(255) NOT NULL,
  `subject` varchar(255) DEFAULT 'General',
  `description` text,
  `summary` text,
  `tags` text, -- Stored as comma-separated values or JSON
  `file_url` text DEFAULT NULL,
  `uploaded_by` varchar(255) DEFAULT 'Unknown',
  `college` varchar(255) NOT NULL,
  `is_flagged` tinyint(1) DEFAULT '0',
  `flag_reason` text,
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for login_logs
-- ----------------------------
CREATE TABLE IF NOT EXISTS `login_logs` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `user_id` int(11) NOT NULL,
  `email` varchar(255) NOT NULL,
  `college` varchar(255) NOT NULL,
  `timestamp` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ----------------------------
-- Table structure for ads
-- ----------------------------
CREATE TABLE IF NOT EXISTS `ads` (
  `id` int(11) NOT NULL AUTO_INCREMENT,
  `placement` varchar(100) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text,
  `link` text,
  `sponsor_name` varchar(255) NOT NULL,
  `is_active` tinyint(1) DEFAULT '1',
  `created_at` datetime DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Insert default ads
INSERT INTO `ads` (`placement`, `title`, `description`, `link`, `sponsor_name`, `is_active`) VALUES
('home_banner', 'Land Your Dream Job!', 'Get 40% off on Premium Placement Prep resources & Mock Interviews using coupon code.', 'https://github.com', 'Premium Placement', 1),
('login_sidebar', 'Sponsor Spotlight', 'Explore our premium partner programs designed to help college students jumpstart their careers in tech.', 'https://github.com', 'Sponsor Partner', 1);

SET FOREIGN_KEY_CHECKS = 1;
