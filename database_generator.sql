-- --------------------------------------------------------
-- Host:                         192.168.1.196
-- Server version:               8.0.33 - MySQL Community Server - GPL
-- Server OS:                    Linux
-- HeidiSQL Version:             12.5.0.6677
-- --------------------------------------------------------

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET NAMES utf8 */;
/*!50503 SET NAMES utf8mb4 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;


-- Dumping database structure for breadbot_test
CREATE DATABASE IF NOT EXISTS `breadbot_test` /*!40100 DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci */ /*!80016 DEFAULT ENCRYPTION='N' */;
USE `breadbot_test`;

-- Dumping structure for table breadbot_test.call_states
CREATE TABLE IF NOT EXISTS `call_states` (
  `call_id` int NOT NULL AUTO_INCREMENT,
  `server_snowflake` bigint unsigned NOT NULL,
  `channel_snowflake` bigint unsigned NOT NULL,
  `call_start_time` datetime NOT NULL,
  `call_end_time` datetime DEFAULT NULL,
  `call_consolidated` bit(1) NOT NULL DEFAULT (0),
  `call_transcribed` bit(1) NOT NULL DEFAULT (0),
  `call_data_cleaned_up` bit(1) NOT NULL DEFAULT (0),
  PRIMARY KEY (`call_id`),
  KEY `fk_snowflake_recording_to_server` (`server_snowflake`),
  KEY `fk_snowflake_recording_to_channel` (`channel_snowflake`),
  CONSTRAINT `fk_snowflake_recording_to_channel` FOREIGN KEY (`channel_snowflake`) REFERENCES `channels` (`channel_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_snowflake_recording_to_server` FOREIGN KEY (`server_snowflake`) REFERENCES `servers` (`server_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=40 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.call_transcriptions
CREATE TABLE IF NOT EXISTS `call_transcriptions` (
  `transcription_id` int NOT NULL AUTO_INCREMENT,
  `call_id` int NOT NULL,
  `user_snowflake` bigint unsigned NOT NULL,
  `speaking_start_time` datetime NOT NULL,
  `text` longtext NOT NULL,
  PRIMARY KEY (`transcription_id`),
  KEY `fk_call_id_states_to_transcriptions` (`call_id`),
  KEY `fk_snowflake_call_states_to_users` (`user_snowflake`),
  CONSTRAINT `fk_call_id_states_to_transcriptions` FOREIGN KEY (`call_id`) REFERENCES `call_states` (`call_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_snowflake_call_states_to_users` FOREIGN KEY (`user_snowflake`) REFERENCES `users` (`user_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.call_users
CREATE TABLE IF NOT EXISTS `call_users` (
  `call_users_id` int NOT NULL AUTO_INCREMENT,
  `call_id` int NOT NULL,
  `user_snowflake` bigint unsigned NOT NULL,
  PRIMARY KEY (`call_users_id`) USING BTREE,
  KEY `fk_call_id_call_user_to_state` (`call_id`),
  KEY `fk_snowflake_call_user_to_users` (`user_snowflake`),
  CONSTRAINT `fk_call_id_call_user_to_state` FOREIGN KEY (`call_id`) REFERENCES `call_states` (`call_id`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_snowflake_call_user_to_users` FOREIGN KEY (`user_snowflake`) REFERENCES `users` (`user_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=13 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.channels
CREATE TABLE IF NOT EXISTS `channels` (
  `channel_snowflake` bigint unsigned NOT NULL,
  `server_snowflake` bigint unsigned NOT NULL,
  `channel_name` text,
  PRIMARY KEY (`channel_snowflake`),
  KEY `fk_snowflake_channel_to_server` (`server_snowflake`),
  CONSTRAINT `fk_snowflake_channel_to_server` FOREIGN KEY (`server_snowflake`) REFERENCES `servers` (`server_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.messages
CREATE TABLE IF NOT EXISTS `messages` (
  `message_snowflake` bigint unsigned NOT NULL,
  `channel_snowflake` bigint unsigned NOT NULL,
  `user_snowflake` bigint unsigned NOT NULL,
  `message_content` text NOT NULL,
  `message_timestamp` datetime NOT NULL,
  `message_deleted` bit(1) NOT NULL DEFAULT (0),
  PRIMARY KEY (`message_snowflake`),
  KEY `fk_snowflake_message_to_channel` (`channel_snowflake`),
  KEY `fk_snowflake_message_to_user` (`user_snowflake`),
  CONSTRAINT `fk_snowflake_message_to_channel` FOREIGN KEY (`channel_snowflake`) REFERENCES `channels` (`channel_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT `fk_snowflake_message_to_user` FOREIGN KEY (`user_snowflake`) REFERENCES `users` (`user_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.message_attachments
CREATE TABLE IF NOT EXISTS `message_attachments` (
  `attachment_snowflake` bigint unsigned NOT NULL,
  `message_snowflake` bigint unsigned NOT NULL DEFAULT (0),
  `attachment_name` text NOT NULL,
  `attachment_description` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `attachment_timestamp` datetime NOT NULL,
  `attachment_mime_type` tinytext CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  `attachment_url` text NOT NULL,
  `attachment_downloaded` bit(1) NOT NULL DEFAULT (0),
  PRIMARY KEY (`attachment_snowflake`) USING BTREE,
  KEY `fk_snowflake_messages_to_attachments` (`message_snowflake`),
  CONSTRAINT `fk_snowflake_messages_to_attachments` FOREIGN KEY (`message_snowflake`) REFERENCES `messages` (`message_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.message_content_changes
CREATE TABLE IF NOT EXISTS `message_content_changes` (
  `message_change_id` int unsigned NOT NULL AUTO_INCREMENT,
  `message_snowflake` bigint unsigned NOT NULL,
  `message_change_old_timestamp` datetime NOT NULL,
  `message_change_old_content` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  PRIMARY KEY (`message_change_id`),
  KEY `fk_snowflake_message_to_message_changes` (`message_snowflake`),
  CONSTRAINT `fk_snowflake_message_to_message_changes` FOREIGN KEY (`message_snowflake`) REFERENCES `messages` (`message_snowflake`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=12 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.servers
CREATE TABLE IF NOT EXISTS `servers` (
  `server_snowflake` bigint unsigned NOT NULL,
  `server_name` text NOT NULL,
  `server_description` mediumtext,
  PRIMARY KEY (`server_snowflake`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.users
CREATE TABLE IF NOT EXISTS `users` (
  `user_snowflake` bigint unsigned NOT NULL,
  `user_name` text NOT NULL,
  `user_displayname` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci,
  PRIMARY KEY (`user_snowflake`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.winston_breadbot
CREATE TABLE IF NOT EXISTS `winston_breadbot` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level` varchar(16) NOT NULL,
  `message` varchar(2048) NOT NULL,
  `meta` varchar(2048) NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=26 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

-- Dumping structure for table breadbot_test.winston_sqlutil
CREATE TABLE IF NOT EXISTS `winston_sqlutil` (
  `id` int NOT NULL AUTO_INCREMENT,
  `level` varchar(16) NOT NULL,
  `message` varchar(2048) NOT NULL,
  `meta` varchar(2048) NOT NULL,
  `timestamp` datetime NOT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB AUTO_INCREMENT=9 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;

-- Data exporting was unselected.

/*!40103 SET TIME_ZONE=IFNULL(@OLD_TIME_ZONE, 'system') */;
/*!40101 SET SQL_MODE=IFNULL(@OLD_SQL_MODE, '') */;
/*!40014 SET FOREIGN_KEY_CHECKS=IFNULL(@OLD_FOREIGN_KEY_CHECKS, 1) */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40111 SET SQL_NOTES=IFNULL(@OLD_SQL_NOTES, 1) */;
