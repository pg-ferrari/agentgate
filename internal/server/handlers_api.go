package server

import (
	"encoding/json"
	"net/http"
	"time"

	"github.com/siygle/agentgate/internal/db"
	"github.com/siygle/agentgate/internal/id"
)

const defaultExpiry = 7 * 24 * time.Hour

// createRequest is the JSON body for both diff and file-bundle creation.
type createRequest struct {
	EncryptedData struct {
		Ciphertext string `json:"ciphertext"`
		IV         string `json:"iv"`
		Salt       string `json:"salt"`
	} `json:"encrypted_data"`
	ExpiresInSeconds int64 `json:"expires_in_seconds,omitempty"`
}

type apiResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Error   string      `json:"error,omitempty"`
}

type createResponseData struct {
	PreviewURL string `json:"preview_url"`
	ID         string `json:"id"`
}

// handleCreateDiff creates an encrypted diff record.
func (s *Server) handleCreateDiff(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiResponse{
			Success: false,
			Error:   "invalid JSON body",
		})
		return
	}

	if req.EncryptedData.Ciphertext == "" || req.EncryptedData.IV == "" || req.EncryptedData.Salt == "" {
		writeJSON(w, http.StatusBadRequest, apiResponse{
			Success: false,
			Error:   "encrypted_data must include non-empty ciphertext, iv, and salt",
		})
		return
	}

	encJSON, err := json.Marshal(req.EncryptedData)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiResponse{
			Success: false,
			Error:   "internal server error",
		})
		return
	}

	newID := id.Generate()
	expiry := time.Now().Add(resolveExpiry(req.ExpiresInSeconds))

	if err := db.CreateDiff(s.db, newID, string(encJSON), expiry); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiResponse{
			Success: false,
			Error:   "internal server error",
		})
		return
	}

	writeJSON(w, http.StatusCreated, apiResponse{
		Success: true,
		Data: createResponseData{
			PreviewURL: s.baseURL + "/p/" + newID,
			ID:         newID,
		},
	})
}

// handleCreateFiles creates an encrypted file bundle record.
func (s *Server) handleCreateFiles(w http.ResponseWriter, r *http.Request) {
	var req createRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		writeJSON(w, http.StatusBadRequest, apiResponse{
			Success: false,
			Error:   "invalid JSON body",
		})
		return
	}

	if req.EncryptedData.Ciphertext == "" || req.EncryptedData.IV == "" || req.EncryptedData.Salt == "" {
		writeJSON(w, http.StatusBadRequest, apiResponse{
			Success: false,
			Error:   "encrypted_data must include non-empty ciphertext, iv, and salt",
		})
		return
	}

	encJSON, err := json.Marshal(req.EncryptedData)
	if err != nil {
		writeJSON(w, http.StatusInternalServerError, apiResponse{
			Success: false,
			Error:   "internal server error",
		})
		return
	}

	newID := id.Generate()
	expiry := time.Now().Add(resolveExpiry(req.ExpiresInSeconds))

	if err := db.CreateFileBundle(s.db, newID, string(encJSON), expiry); err != nil {
		writeJSON(w, http.StatusInternalServerError, apiResponse{
			Success: false,
			Error:   "internal server error",
		})
		return
	}

	writeJSON(w, http.StatusCreated, apiResponse{
		Success: true,
		Data: createResponseData{
			PreviewURL: s.baseURL + "/f/" + newID,
			ID:         newID,
		},
	})
}

func resolveExpiry(expiresInSeconds int64) time.Duration {
	if expiresInSeconds <= 0 {
		return defaultExpiry
	}
	return time.Duration(expiresInSeconds) * time.Second
}

// writeJSON encodes v as JSON and writes it with the given status code.
func writeJSON(w http.ResponseWriter, status int, v interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	json.NewEncoder(w).Encode(v)
}
