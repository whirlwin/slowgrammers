-- Hall of fame entries. Only ever written by an operator via
-- `wrangler d1 execute --remote`; the Worker has no write path here.
CREATE TABLE slowgrammers (
  id INTEGER PRIMARY KEY,
  handle TEXT NOT NULL,
  display_name TEXT NOT NULL,
  followers INTEGER NOT NULL DEFAULT 0,
  quote TEXT NOT NULL,
  post_url TEXT NOT NULL UNIQUE,
  posted_at TEXT,
  added_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now'))
);

-- One vote per voter per entry per UTC day, enforced by the UNIQUE constraint.
-- voter_hash is SHA-256(client IP + VOTE_SALT); raw IPs are never stored.
CREATE TABLE votes (
  id INTEGER PRIMARY KEY,
  entry_id INTEGER NOT NULL REFERENCES slowgrammers(id) ON DELETE CASCADE,
  voter_hash TEXT NOT NULL,
  day TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%SZ', 'now')),
  reason TEXT CHECK (reason IS NULL OR length(reason) <= 200),
  UNIQUE (entry_id, voter_hash, day)
);

CREATE INDEX votes_entry_id ON votes (entry_id);
