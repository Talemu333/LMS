USE eles_lms;

-- Safe for both legacy databases and databases created from schema.sql.
SET @column_exists := (
  SELECT COUNT(*)
  FROM INFORMATION_SCHEMA.COLUMNS
  WHERE TABLE_SCHEMA = DATABASE()
    AND TABLE_NAME = 'course_units'
    AND COLUMN_NAME = 'status'
);

SET @sql := IF(
  @column_exists = 0,
  "ALTER TABLE course_units ADD COLUMN status ENUM('Mandatory', 'Optional') NOT NULL DEFAULT 'Mandatory' AFTER unit_order",
  'SELECT 1'
);

PREPARE add_unit_status FROM @sql;
EXECUTE add_unit_status;
DEALLOCATE PREPARE add_unit_status;
