USE eles_lms;

ALTER TABLE course_units
  ADD COLUMN status ENUM('Mandatory', 'Optional') NOT NULL DEFAULT 'Mandatory'
  AFTER unit_order;
