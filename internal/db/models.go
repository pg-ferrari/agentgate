package db

import (
	"database/sql"
	"time"
)

// Diff represents an encrypted diff stored in the database.
type Diff struct {
	ID             string
	EncryptedData  string // JSON string
	ExpiredAt      time.Time
	CreatedAt      time.Time
	NeverExpires   bool
	OwnerTokenHash sql.NullString
}

// FileBundle represents an encrypted file bundle stored in the database.
type FileBundle struct {
	ID             string
	EncryptedData  string
	ExpiredAt      time.Time
	CreatedAt      time.Time
	NeverExpires   bool
	OwnerTokenHash sql.NullString
}
