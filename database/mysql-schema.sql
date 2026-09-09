SET NAMES utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS users (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(190) NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  role VARCHAR(30) NOT NULL,
  division VARCHAR(120) NOT NULL,
  division_label VARCHAR(120) NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  created_at VARCHAR(40) NOT NULL,
  is_core TINYINT(1) NOT NULL DEFAULT 0,
  PRIMARY KEY (id), UNIQUE KEY uq_users_email (email), KEY idx_users_division (division)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS sessions (
  token_hash CHAR(64) NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL,
  csrf_token VARCHAR(100) NOT NULL,
  expires_at VARCHAR(40) NOT NULL,
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (token_hash), KEY idx_sessions_expiry (expires_at),
  CONSTRAINT fk_sessions_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS login_attempts (
  attempt_key CHAR(64) NOT NULL,
  failed_count INT UNSIGNED NOT NULL DEFAULT 0,
  lock_until VARCHAR(40) NOT NULL DEFAULT '',
  updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (attempt_key), KEY idx_login_attempts_updated (updated_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS fiscal_years (
  fiscal_year SMALLINT UNSIGNED NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'planning',
  prepared_by BIGINT UNSIGNED NULL, prepared_at VARCHAR(40) NOT NULL DEFAULT '',
  opened_by BIGINT UNSIGNED NULL, opened_at VARCHAR(40) NOT NULL DEFAULT '',
  closed_by BIGINT UNSIGNED NULL, closed_at VARCHAR(40) NOT NULL DEFAULT '',
  note TEXT NOT NULL,
  PRIMARY KEY (fiscal_year), KEY idx_fiscal_status (status),
  CONSTRAINT fk_fiscal_preparer FOREIGN KEY (prepared_by) REFERENCES users(id),
  CONSTRAINT fk_fiscal_opener FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_fiscal_closer FOREIGN KEY (closed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS targets (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  division VARCHAR(120) NOT NULL, program VARCHAR(180) NOT NULL,
  target_type VARCHAR(20) NOT NULL, period VARCHAR(20) NOT NULL, target_year SMALLINT UNSIGNED NOT NULL,
  target_value DECIMAL(18,2) NOT NULL, unit VARCHAR(80) NOT NULL,
  note TEXT NOT NULL, active TINYINT(1) NOT NULL DEFAULT 1, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), KEY idx_targets_division (division), KEY idx_targets_year (target_year),
  CONSTRAINT fk_targets_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS weekly_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, target_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL, week_start DATE NOT NULL,
  actual_value DECIMAL(18,2) NOT NULL, note TEXT NOT NULL, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_weekly_target_date (target_id,week_start), KEY idx_weekly_date (week_start),
  CONSTRAINT fk_weekly_target FOREIGN KEY (target_id) REFERENCES targets(id) ON DELETE CASCADE,
  CONSTRAINT fk_weekly_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS realizations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  division VARCHAR(120) NOT NULL, program VARCHAR(180) NOT NULL, realization_date DATE NOT NULL,
  value DECIMAL(18,2) NOT NULL, note TEXT NOT NULL, partner_name VARCHAR(190) NOT NULL DEFAULT '',
  distribution_route VARCHAR(190) NOT NULL DEFAULT '', report_period VARCHAR(20) NOT NULL DEFAULT 'mingguan',
  swot_strengths TEXT NOT NULL, swot_weaknesses TEXT NOT NULL, swot_opportunities TEXT NOT NULL,
  swot_threats TEXT NOT NULL, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), KEY idx_realizations_division (division),
  CONSTRAINT fk_realizations_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS evaluations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  division VARCHAR(120) NOT NULL, finding TEXT NOT NULL, action TEXT NOT NULL,
  period_start DATE NULL, period_end DATE NULL, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), CONSTRAINT fk_evaluations_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS donors (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  division VARCHAR(120) NOT NULL, name VARCHAR(190) NOT NULL, phone VARCHAR(80) NOT NULL DEFAULT '',
  address TEXT NOT NULL, donor_type VARCHAR(100) NOT NULL, status VARCHAR(20) NOT NULL,
  joined_at DATE NOT NULL, note TEXT NOT NULL, placement_type VARCHAR(100) NOT NULL DEFAULT '',
  distribution_route VARCHAR(190) NOT NULL DEFAULT '', maps_url TEXT NOT NULL, photo_data LONGTEXT NOT NULL,
  donation_frequency VARCHAR(100) NOT NULL DEFAULT 'Belum rutin', education_level VARCHAR(30) NOT NULL DEFAULT '',
  current_class VARCHAR(60) NOT NULL DEFAULT '', academic_year VARCHAR(20) NOT NULL DEFAULT '', created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), KEY idx_donors_division (division),
  CONSTRAINT fk_donors_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budget_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, request_code VARCHAR(60) NOT NULL,
  requester_id BIGINT UNSIGNED NOT NULL, division VARCHAR(120) NOT NULL,
  amount DECIMAL(18,2) NOT NULL, purpose TEXT NOT NULL, status VARCHAR(40) NOT NULL DEFAULT 'submitted',
  chair_approval_required TINYINT(1) NOT NULL DEFAULT 1,
  chair_approval_limit DECIMAL(18,2) NOT NULL DEFAULT 500000,
  treasurer_by BIGINT UNSIGNED NULL, treasurer_at VARCHAR(40) NOT NULL DEFAULT '',
  chair_by BIGINT UNSIGNED NULL, chair_at VARCHAR(40) NOT NULL DEFAULT '',
  disbursed_by BIGINT UNSIGNED NULL, disbursed_at VARCHAR(40) NOT NULL DEFAULT '',
  disbursed_amount DECIMAL(18,2) NOT NULL DEFAULT 0, rejection_note TEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_budget_code (request_code), KEY idx_budget_status (status),
  CONSTRAINT fk_budget_requester FOREIGN KEY (requester_id) REFERENCES users(id),
  CONSTRAINT fk_budget_treasurer FOREIGN KEY (treasurer_by) REFERENCES users(id),
  CONSTRAINT fk_budget_chair FOREIGN KEY (chair_by) REFERENCES users(id),
  CONSTRAINT fk_budget_disburser FOREIGN KEY (disbursed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS app_settings (
  setting_key VARCHAR(100) NOT NULL, setting_value VARCHAR(255) NOT NULL,
  updated_by BIGINT UNSIGNED NULL, updated_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (setting_key),
  CONSTRAINT fk_setting_user FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS distribution_routes (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  route_name VARCHAR(190) NOT NULL, sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  active TINYINT(1) NOT NULL DEFAULT 1, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_distribution_route_name (route_name),
  KEY idx_distribution_route_active (active,sort_order)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS reference_options (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  option_type VARCHAR(60) NOT NULL, option_value VARCHAR(190) NOT NULL,
  sort_order INT UNSIGNED NOT NULL DEFAULT 0, active TINYINT(1) NOT NULL DEFAULT 1,
  created_by BIGINT UNSIGNED NULL, updated_by BIGINT UNSIGNED NULL,
  created_at VARCHAR(40) NOT NULL, updated_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (id), UNIQUE KEY uq_reference_option (option_type,option_value),
  KEY idx_reference_option_active (option_type,active,sort_order),
  CONSTRAINT fk_reference_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_reference_updated_by FOREIGN KEY (updated_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS academic_years (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, year_label VARCHAR(20) NOT NULL,
  start_year SMALLINT UNSIGNED NOT NULL, status VARCHAR(20) NOT NULL DEFAULT 'planning',
  created_by BIGINT UNSIGNED NULL, opened_by BIGINT UNSIGNED NULL, closed_by BIGINT UNSIGNED NULL,
  created_at VARCHAR(40) NOT NULL, opened_at VARCHAR(40) NOT NULL DEFAULT '', closed_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (id), UNIQUE KEY uq_academic_year_label (year_label), KEY idx_academic_year_status (status),
  CONSTRAINT fk_academic_created_by FOREIGN KEY (created_by) REFERENCES users(id),
  CONSTRAINT fk_academic_opened_by FOREIGN KEY (opened_by) REFERENCES users(id),
  CONSTRAINT fk_academic_closed_by FOREIGN KEY (closed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transactions (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  division VARCHAR(120) NOT NULL, transaction_date DATE NOT NULL, transaction_type VARCHAR(20) NOT NULL,
  category VARCHAR(160) NOT NULL, amount DECIMAL(18,2) NOT NULL, description TEXT NOT NULL,
  source_name VARCHAR(190) NOT NULL DEFAULT '', donor_id BIGINT UNSIGNED NULL,
  source_class VARCHAR(120) NOT NULL DEFAULT '',
  source_origin VARCHAR(190) NOT NULL DEFAULT '', distribution_route VARCHAR(190) NOT NULL DEFAULT '',
  source_education_level VARCHAR(30) NOT NULL DEFAULT '', academic_year VARCHAR(20) NOT NULL DEFAULT '',
  accounting_type VARCHAR(40) NOT NULL DEFAULT 'direct', budget_request_id BIGINT UNSIGNED NULL,
  created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), KEY idx_transactions_division (division), KEY idx_transactions_date (transaction_date),
  KEY idx_transactions_donor (donor_id),
  CONSTRAINT fk_transactions_user FOREIGN KEY (user_id) REFERENCES users(id),
  CONSTRAINT fk_transactions_budget FOREIGN KEY (budget_request_id) REFERENCES budget_requests(id),
  CONSTRAINT fk_transactions_donor FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS donor_class_assignments (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, donor_id BIGINT UNSIGNED NOT NULL,
  academic_year VARCHAR(20) NOT NULL, education_level VARCHAR(30) NOT NULL,
  class_name VARCHAR(60) NOT NULL, assignment_status VARCHAR(20) NOT NULL DEFAULT 'active',
  promoted_from BIGINT UNSIGNED NULL, created_by BIGINT UNSIGNED NULL, created_at VARCHAR(40) NOT NULL,
  PRIMARY KEY (id), UNIQUE KEY uq_donor_academic_assignment (donor_id,academic_year),
  KEY idx_class_assignment_year (academic_year,education_level,class_name),
  CONSTRAINT fk_class_assignment_donor FOREIGN KEY (donor_id) REFERENCES donors(id) ON DELETE CASCADE,
  CONSTRAINT fk_class_assignment_creator FOREIGN KEY (created_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS executive_reports (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, user_id BIGINT UNSIGNED NOT NULL,
  date_from DATE NOT NULL, date_to DATE NOT NULL, title VARCHAR(255) NOT NULL,
  summary LONGTEXT NOT NULL, recommendations LONGTEXT NOT NULL, ai_used TINYINT(1) NOT NULL DEFAULT 0,
  created_at VARCHAR(40) NOT NULL, PRIMARY KEY (id), KEY idx_executive_period (date_from,date_to),
  CONSTRAINT fk_executive_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS user_deletion_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, target_user_id BIGINT UNSIGNED NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED NULL, requested_at VARCHAR(40) NOT NULL, reviewed_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (id), KEY idx_user_deletion_status (status),
  CONSTRAINT fk_delete_target FOREIGN KEY (target_user_id) REFERENCES users(id),
  CONSTRAINT fk_delete_requester FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_delete_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS approval_requests (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, request_type VARCHAR(60) NOT NULL,
  requested_by BIGINT UNSIGNED NOT NULL, title VARCHAR(255) NOT NULL, details TEXT NOT NULL,
  payload LONGTEXT NOT NULL, status VARCHAR(30) NOT NULL DEFAULT 'pending', reviewed_by BIGINT UNSIGNED NULL,
  requested_at VARCHAR(40) NOT NULL, reviewed_at VARCHAR(40) NOT NULL DEFAULT '',
  PRIMARY KEY (id), KEY idx_approval_status (status),
  CONSTRAINT fk_approval_requester FOREIGN KEY (requested_by) REFERENCES users(id),
  CONSTRAINT fk_approval_reviewer FOREIGN KEY (reviewed_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS budget_usages (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT, budget_request_id BIGINT UNSIGNED NOT NULL,
  user_id BIGINT UNSIGNED NOT NULL, usage_date DATE NOT NULL, category VARCHAR(160) NOT NULL,
  amount DECIMAL(18,2) NOT NULL, description TEXT NOT NULL, proof_note TEXT NOT NULL,
  created_at VARCHAR(40) NOT NULL, PRIMARY KEY (id), KEY idx_budget_usage_request (budget_request_id),
  CONSTRAINT fk_usage_budget FOREIGN KEY (budget_request_id) REFERENCES budget_requests(id) ON DELETE CASCADE,
  CONSTRAINT fk_usage_user FOREIGN KEY (user_id) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS transparency_publications (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  snapshot_date DATE NOT NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  public_data LONGTEXT NOT NULL,
  approved_by BIGINT UNSIGNED NOT NULL,
  approved_at VARCHAR(40) NOT NULL,
  active TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (id), KEY idx_transparency_active (active,approved_at),
  CONSTRAINT fk_transparency_approver FOREIGN KEY (approved_by) REFERENCES users(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
