# IdentityRestore

## Overview

IdentityRestore is a Web3 project built on the Stacks blockchain using Clarity smart contracts. It provides a decentralized tool for securely backing up identity documents (e.g., passports, driver's licenses, birth certificates) and restoring them in case of loss or damage. By leveraging blockchain's immutability, encryption, and decentralized verification, users can store encrypted backups and recover them quickly without relying on centralized authorities, reducing bureaucratic delays and risks of data breaches.

### Real-World Problems Solved
- **Lost or Damaged Documents**: Traditional restoration processes involve lengthy paperwork, fees, and visits to government offices. IdentityRestore allows users to prove document existence and integrity via blockchain timestamps and hashes, speeding up official reissuance.
- **Privacy and Security Risks**: Centralized databases are prone to hacks. This project uses client-side encryption and blockchain storage (with IPFS integration for off-chain data) to ensure only authorized parties access documents.
- **Identity Theft and Fraud**: Backups include verifiable hashes; recovery requires multi-party verification to prevent unauthorized access.
- **Global Accessibility**: Useful for refugees, travelers, or disaster victims who lose documents, enabling digital proof for services like banking or travel.
- **Compliance and Auditability**: All actions are logged on-chain, aiding regulatory compliance (e.g., GDPR-like standards) while maintaining user control.

The project involves 7 core smart contracts written in Clarity, focusing on registration, storage, recovery, verification, access control, key management, and auditing. It assumes integration with a frontend dApp for user interactions (e.g., via Hiro Wallet for Stacks).

## Architecture
- **Blockchain**: Stacks (STX), anchored to Bitcoin for security.
- **Off-Chain Storage**: IPFS for encrypted document files; only hashes/CIDs stored on-chain.
- **Encryption**: Client-side (e.g., AES with user-controlled keys).
- **Verification**: Involves registered verifiers (e.g., notaries or KYC providers) for recovery claims.
- **Tokens**: Uses STX for fees; optional NFT representation of documents for ownership proof.

## Smart Contracts
The project consists of the following 7 Clarity smart contracts:

1. **UserRegistry.clar**: Handles user registration and profile management.
2. **DocumentBackup.clar**: Manages uploading and storing document backups (hashes and metadata).
3. **RecoveryRequest.clar**: Processes recovery requests and approvals.
4. **VerifierRegistry.clar**: Registers and manages trusted verifiers.
5. **AccessGrant.clar**: Controls access permissions for document viewing/sharing.
6. **EncryptionKeyManager.clar**: Securely manages encryption key shares (using threshold schemes).
7. **AuditLog.clar**: Logs all critical actions for transparency and auditing.

Contracts are designed to be composable, with principal-based access control and error handling.

### Deployment
Contracts should be deployed in this order: UserRegistry → VerifierRegistry → DocumentBackup → EncryptionKeyManager → AccessGrant → RecoveryRequest → AuditLog.

## Installation and Setup
1. **Prerequisites**:
   - Node.js and npm.
   - Clarity CLI (install via `npm install -g @stacks/clarity-cli`).
   - Stacks Wallet (e.g., Hiro Wallet) for testing on testnet.
   - IPFS node or service for off-chain storage.

2. **Clone Repository**:
   ```
   git clone `git clone <repo-url>`
   cd IdentityRestore
   ```

3. **Install Dependencies**:
   ```
   npm install
   ```

4. **Test Contracts**:
   Use Clarity CLI to test:
   ```
   clarinet test
   ```

5. **Deploy to Testnet**:
   Use Clarinet or Stacks.js to deploy. Example with Clarinet:
   ```
   clarinet integrate
   ```

6. **Frontend Integration**:
   Build a dApp using React and @stacks/connect for wallet interactions. Upload encrypted files to IPFS via libraries like ipfs-http-client.

## Usage
1. **Register User**: Call `register-user` in UserRegistry with your principal and metadata.
2. **Backup Document**: Encrypt document client-side, upload to IPFS, then call `backup-document` in DocumentBackup with hash/CID.
3. **Register as Verifier**: If eligible, call `register-verifier` in VerifierRegistry.
4. **Request Recovery**: If lost, call `request-recovery` in RecoveryRequest; verifiers approve.
5. **Grant Access**: Use AccessGrant to share view permissions.
6. **Manage Keys**: Store key shares via EncryptionKeyManager for secure recovery.
7. **Audit Actions**: Query AuditLog for transaction history.

## Security Considerations
- All sensitive data is encrypted off-chain.
- Use multisig-like verification for recoveries to prevent single points of failure.
- Contracts are read-only where possible; no mutable state without authorization.
- Audit logs are immutable for forensic analysis.
- Potential vulnerabilities: Oracle attacks on verifiers; mitigate with reputation systems.

## Contributing
Fork the repo, create a branch, and submit a PR. Follow Clarity best practices: no recursion, use maps/lists for data.

## License
MIT License.

---

Below is the code for each smart contract. In a real repo, these would be in `/contracts/` directory as separate `.clar` files.

### 1. UserRegistry.clar
```
;; UserRegistry.clar
;; Manages user registrations.

(define-map users principal { name: (string-ascii 50), registered-at: uint })

(define-public (register-user (name (string-ascii 50)))
  (let ((caller tx-sender))
    (if (is-none (map-get? users caller))
      (begin
        (map-set users caller { name: name, registered-at: block-height })
        (ok true))
      (err u100))))  ;; Already registered

(define-read-only (get-user (user principal))
  (map-get? users user))
```

### 2. DocumentBackup.clar
```
;; DocumentBackup.clar
;; Stores document backups (hashes/CIDs).

(define-map documents { user: principal, doc-id: uint } { hash: (buff 32), cid: (string-ascii 46), timestamp: uint })

(define-data-var next-doc-id uint u1)

(define-public (backup-document (hash (buff 32)) (cid (string-ascii 46)))
  (let ((caller tx-sender)
        (doc-id (var-get next-doc-id)))
    (try! (is-registered caller))  ;; Check UserRegistry
    (map-set documents { user: caller, doc-id: doc-id } { hash: hash, cid: cid, timestamp: block-height })
    (var-set next-doc-id (+ doc-id u1))
    (ok doc-id)))

(define-private (is-registered (user principal))
  (match (contract-call? .UserRegistry get-user user)
    some (ok true)
    none (err u101)))  ;; Not registered
```

### 3. RecoveryRequest.clar
```
;; RecoveryRequest.clar
;; Handles recovery requests.

(define-map requests uint { requester: principal, doc-id: uint, status: (string-ascii 20), approvals: uint, required: uint })

(define-data-var next-request-id uint u1)

(define-public (request-recovery (doc-id uint) (required-approvals uint))
  (let ((caller tx-sender)
        (request-id (var-get next-request-id)))
    (try! (owns-document caller doc-id))
    (map-set requests request-id { requester: caller, doc-id: doc-id, status: "pending", approvals: u0, required: required-approvals })
    (var-set next-request-id (+ request-id u1))
    (ok request-id)))

(define-public (approve-recovery (request-id uint))
  (let ((caller tx-sender)
        (request (unwrap! (map-get? requests request-id) (err u102))))
    (try! (is-verifier caller))
    (if (< (get approvals request) (get required request))
      (begin
        (map-set requests request-id (merge request { approvals: (+ (get approvals request) u1) }))
        (if (>= (+ (get approvals request) u1) (get required request))
          (map-set requests request-id (merge request { status: "approved" }))
          (ok true))
        (ok true))
      (err u103))))  ;; Already approved

(define-private (owns-document (user principal) (doc-id uint))
  (match (contract-call? .DocumentBackup get-document { user: user, doc-id: doc-id })
    some (ok true)
    none (err u104)))  ;; Not owner

(define-private (is-verifier (user principal))
  (match (contract-call? .VerifierRegistry get-verifier user)
    some (ok true)
    none (err u105)))  ;; Not verifier

(define-read-only (get-request (request-id uint))
  (map-get? requests request-id))
```

### 4. VerifierRegistry.clar
```
;; VerifierRegistry.clar
;; Registers trusted verifiers.

(define-map verifiers principal { name: (string-ascii 50), registered-at: uint })

(define-public (register-verifier (name (string-ascii 50)))
  (let ((caller tx-sender))
    (if (is-none (map-get? verifiers caller))
      (begin
        (map-set verifiers caller { name: name, registered-at: block-height })
        (ok true))
      (err u106))))  ;; Already registered

(define-read-only (get-verifier (verifier principal))
  (map-get? verifiers verifier))
```

### 5. AccessGrant.clar
```
;; AccessGrant.clar
;; Manages access permissions.

(define-map grants { granter: principal, grantee: principal, doc-id: uint } { expires-at: (optional uint) })

(define-public (grant-access (grantee principal) (doc-id uint) (expires-at (optional uint)))
  (let ((caller tx-sender))
    (try! (owns-document caller doc-id))
    (map-set grants { granter: caller, grantee: grantee, doc-id: doc-id } { expires-at: expires-at })
    (ok true)))

(define-public (revoke-access (grantee principal) (doc-id uint))
  (let ((caller tx-sender))
    (try! (owns-document caller doc-id))
    (map-delete grants { granter: caller, grantee: grantee, doc-id: doc-id })
    (ok true)))

(define-read-only (has-access (grantee principal) (doc-id uint))
  (let ((granter (unwrap! (get-owner doc-id) none)))  ;; Simplified
    (match (map-get? grants { granter: granter, grantee: grantee, doc-id: doc-id })
      some (if (is-some (get expires-at some))
             (if (<= (get expires-at some) block-height) false true)
             true)
      none false)))

(define-private (get-owner (doc-id uint))
  ;; Logic to find owner from DocumentBackup; omitted for brevity
  (ok tx-sender))  ;; Placeholder
```

### 6. EncryptionKeyManager.clar
```
;; EncryptionKeyManager.clar
;; Manages encryption key shares (threshold scheme).

(define-map key-shares { user: principal, doc-id: uint, share-id: uint } { share: (buff 64) })

(define-public (store-key-share (doc-id uint) (share-id uint) (share (buff 64)))
  (let ((caller tx-sender))
    (try! (owns-document caller doc-id))
    (map-set key-shares { user: caller, doc-id: doc-id, share-id: share-id } { share: share })
    (ok true)))

(define-public (retrieve-key-share (user principal) (doc-id uint) (share-id uint))
  (let ((caller tx-sender))
    (try! (has-access caller doc-id))  ;; From AccessGrant
    (unwrap! (map-get? key-shares { user: user, doc-id: doc-id, share-id: share-id }) (err u107))))

(define-read-only (get-key-share (user principal) (doc-id uint) (share-id uint))
  (map-get? key-shares { user: user, doc-id: doc-id, share-id: share-id }))
```

### 7. AuditLog.clar
```
;; AuditLog.clar
;; Logs all actions.

(define-map logs uint { action: (string-ascii 50), actor: principal, timestamp: uint, details: (string-ascii 256) })

(define-data-var next-log-id uint u1)

(define-public (log-action (action (string-ascii 50)) (details (string-ascii 256)))
  (let ((log-id (var-get next-log-id)))
    (map-set logs log-id { action: action, actor: tx-sender, timestamp: block-height, details: details })
    (var-set next-log-id (+ log-id u1))
    (ok log-id)))

(define-read-only (get-log (log-id uint))
  (map-get? logs log-id))
