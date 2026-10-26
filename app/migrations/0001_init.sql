CREATE TABLE IF NOT EXISTS neighborhood_reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  city TEXT NOT NULL,
  area TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  category TEXT NOT NULL,
  feeling TEXT NOT NULL,
  note TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS reports_public_feed ON neighborhood_reports(status, created_at DESC);
CREATE TABLE IF NOT EXISTS report_comments (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  report_id INTEGER NOT NULL REFERENCES neighborhood_reports(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Neighbor',
  body TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comments_public_feed ON report_comments(report_id, status, created_at ASC);
