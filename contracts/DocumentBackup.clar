(define-constant ERR-NOT-AUTHORIZED u100)
(define-constant ERR-INVALID-HASH u101)
(define-constant ERR-INVALID-CID u102)
(define-constant ERR-INVALID-DOC-TYPE u103)
(define-constant ERR-INVALID-TIMESTAMP u104)
(define-constant ERR-INVALID-METADATA u105)
(define-constant ERR-DOC-ALREADY-EXISTS u106)
(define-constant ERR-DOC-NOT-FOUND u107)
(define-constant ERR-USER-NOT-REGISTERED u108)
(define-constant ERR-INVALID-OWNER u109)
(define-constant ERR-INVALID-STATUS u110)
(define-constant ERR-INVALID-VERSION u111)
(define-constant ERR-MAX-DOCS-EXCEEDED u112)
(define-constant ERR-INVALID-UPDATE-PARAM u113)
(define-constant ERR-UPDATE-NOT-ALLOWED u114)
(define-constant ERR-INVALID-EXPIRY u115)
(define-constant ERR-INVALID-SIZE u116)
(define-constant ERR-INVALID-LOCATION u117)
(define-constant ERR-INVALID-CURRENCY u118)
(define-constant ERR-AUTHORITY-NOT-SET u119)
(define-constant ERR-INVALID-AUTHORITY u120)
(define-constant ERR-INVALID-FEE u121)
(define-constant ERR-INVALID-DOC_NAME u122)
(define-constant ERR-INVALID-DESCRIPTION u123)
(define-constant ERR-INVALID-CATEGORY u124)
(define-constant ERR-INVALID-TAGS u125)
(define-constant ERR-INVALID-ACCESS_LEVEL u126)
(define-constant ERR-INVALID-ENCRYPTION_TYPE u127)
(define-constant ERR-INVALID-VERIFIER u128)
(define-constant ERR-INVALID-SIGNATURE u129)
(define-constant ERR-INVALID-PROOF u130)

(define-data-var next-doc-id uint u1)
(define-data-var max-docs-per-user uint u50)
(define-data-var backup-fee uint u500)
(define-data-var authority-contract (optional principal) none)
(define-data-var doc-count uint u0)

(define-map documents
  { user: principal, doc-id: uint }
  {
    hash: (buff 32),
    cid: (string-ascii 46),
    timestamp: uint,
    doc-type: (string-utf8 50),
    metadata: (string-utf8 256),
    owner: principal,
    status: bool,
    version: uint,
    expiry: (optional uint),
    size: uint,
    location: (string-utf8 100),
    currency: (string-utf8 20),
    doc-name: (string-utf8 100),
    description: (string-utf8 200),
    category: (string-utf8 50),
    tags: (list 10 (string-utf8 20)),
    access-level: uint,
    encryption-type: (string-utf8 50),
    verifier: (optional principal),
    signature: (optional (buff 65)),
    proof: (optional (buff 128))
  }
)

(define-map docs-by-hash
  (buff 32)
  { user: principal, doc-id: uint }
)

(define-map doc-updates
  { user: principal, doc-id: uint }
  {
    update-timestamp: uint,
    updater: principal,
    old-hash: (buff 32),
    new-hash: (buff 32),
    update-reason: (string-utf8 100)
  }
)

(define-map user-doc-counts
  principal
  uint
)

(define-read-only (get-document (user principal) (doc-id uint))
  (map-get? documents { user: user, doc-id: doc-id })
)

(define-read-only (get-doc-updates (user principal) (doc-id uint))
  (map-get? doc-updates { user: user, doc-id: doc-id })
)

(define-read-only (get-user-doc-count (user principal))
  (default-to u0 (map-get? user-doc-counts user))
)

(define-read-only (is-doc-registered (hash (buff 32)))
  (is-some (map-get? docs-by-hash hash))
)

(define-private (validate-hash (hash (buff 32)))
  (if (is-eq (len hash) u32)
      (ok true)
      (err ERR-INVALID-HASH))
)

(define-private (validate-cid (cid (string-ascii 46)))
  (if (and (> (len cid) u0) (<= (len cid) u46))
      (ok true)
      (err ERR-INVALID-CID))
)

(define-private (validate-doc-type (doc-type (string-utf8 50)))
  (if (or (is-eq doc-type "passport") (is-eq doc-type "license") (is-eq doc-type "certificate") (is-eq doc-type "id-card"))
      (ok true)
      (err ERR-INVALID-DOC-TYPE))
)

(define-private (validate-metadata (metadata (string-utf8 256)))
  (if (<= (len metadata) u256)
      (ok true)
      (err ERR-INVALID-METADATA))
)

(define-private (validate-timestamp (ts uint))
  (if (>= ts block-height)
      (ok true)
      (err ERR-INVALID-TIMESTAMP))
)

(define-private (validate-version (version uint))
  (if (> version u0)
      (ok true)
      (err ERR-INVALID-VERSION))
)

(define-private (validate-expiry (expiry (optional uint)))
  (match expiry
    exp (if (> exp block-height) (ok true) (err ERR-INVALID-EXPIRY))
    (ok true))
)

(define-private (validate-size (size uint))
  (if (<= size u10485760)
      (ok true)
      (err ERR-INVALID-SIZE))
)

(define-private (validate-location (loc (string-utf8 100)))
  (if (<= (len loc) u100)
      (ok true)
      (err ERR-INVALID-LOCATION))
)

(define-private (validate-currency (cur (string-utf8 20)))
  (if (or (is-eq cur "STX") (is-eq cur "USD") (is-eq cur "BTC"))
      (ok true)
      (err ERR-INVALID-CURRENCY))
)

(define-private (validate-doc-name (name (string-utf8 100)))
  (if (and (> (len name) u0) (<= (len name) u100))
      (ok true)
      (err ERR-INVALID-DOC-NAME))
)

(define-private (validate-description (desc (string-utf8 200)))
  (if (<= (len desc) u200)
      (ok true)
      (err ERR-INVALID-DESCRIPTION))
)

(define-private (validate-category (cat (string-utf8 50)))
  (if (<= (len cat) u50)
      (ok true)
      (err ERR-INVALID-CATEGORY))
)

(define-private (validate-tags (tags (list 10 (string-utf8 20))))
  (if (<= (len tags) u10)
      (ok true)
      (err ERR-INVALID-TAGS))
)

(define-private (validate-access-level (level uint))
  (if (<= level u3)
      (ok true)
      (err ERR-INVALID-ACCESS_LEVEL))
)

(define-private (validate-encryption-type (enc (string-utf8 50)))
  (if (or (is-eq enc "AES") (is-eq enc "RSA") (is-eq enc "ECC"))
      (ok true)
      (err ERR-INVALID-ENCRYPTION_TYPE))
)

(define-private (validate-verifier (ver (optional principal)))
  (ok true)
)

(define-private (validate-signature (sig (optional (buff 65))))
  (ok true)
)

(define-private (validate-proof (prf (optional (buff 128))))
  (ok true)
)

(define-private (validate-principal (p principal))
  (if (not (is-eq p 'SP000000000000000000002Q6VF78))
      (ok true)
      (err ERR-NOT-AUTHORIZED))
)

(define-private (is-registered (user principal))
  (match (contract-call? .UserRegistry get-user user)
    some-user (ok true)
    (err ERR-USER-NOT-REGISTERED))
)

(define-public (set-authority-contract (contract-principal principal))
  (begin
    (try! (validate-principal contract-principal))
    (asserts! (is-none (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set authority-contract (some contract-principal))
    (ok true)
  )
)

(define-public (set-max-docs-per-user (new-max uint))
  (begin
    (asserts! (> new-max u0) (err ERR-INVALID-UPDATE-PARAM))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set max-docs-per-user new-max)
    (ok true)
  )
)

(define-public (set-backup-fee (new-fee uint))
  (begin
    (asserts! (>= new-fee u0) (err ERR-INVALID-FEE))
    (asserts! (is-some (var-get authority-contract)) (err ERR-AUTHORITY-NOT-SET))
    (var-set backup-fee new-fee)
    (ok true)
  )
)

(define-public (backup-document
  (hash (buff 32))
  (cid (string-ascii 46))
  (doc-type (string-utf8 50))
  (metadata (string-utf8 256))
  (expiry (optional uint))
  (size uint)
  (location (string-utf8 100))
  (currency (string-utf8 20))
  (doc-name (string-utf8 100))
  (description (string-utf8 200))
  (category (string-utf8 50))
  (tags (list 10 (string-utf8 20)))
  (access-level uint)
  (encryption-type (string-utf8 50))
  (verifier (optional principal))
  (signature (optional (buff 65)))
  (proof (optional (buff 128)))
)
  (let (
        (caller tx-sender)
        (doc-id (var-get next-doc-id))
        (user-count (get-user-doc-count caller))
        (max-docs (var-get max-docs-per-user))
        (authority (var-get authority-contract))
      )
    (asserts! (< user-count max-docs) (err ERR-MAX-DOCS-EXCEEDED))
    (try! (is-registered caller))
    (try! (validate-hash hash))
    (try! (validate-cid cid))
    (try! (validate-doc-type doc-type))
    (try! (validate-metadata metadata))
    (try! (validate-expiry expiry))
    (try! (validate-size size))
    (try! (validate-location location))
    (try! (validate-currency currency))
    (try! (validate-doc-name doc-name))
    (try! (validate-description description))
    (try! (validate-category category))
    (try! (validate-tags tags))
    (try! (validate-access-level access-level))
    (try! (validate-encryption-type encryption-type))
    (try! (validate-verifier verifier))
    (try! (validate-signature signature))
    (try! (validate-proof proof))
    (asserts! (is-none (map-get? docs-by-hash hash)) (err ERR-DOC-ALREADY-EXISTS))
    (let ((authority-recipient (unwrap! authority (err ERR-AUTHORITY-NOT-SET))))
      (try! (stx-transfer? (var-get backup-fee) caller authority-recipient))
    )
    (map-set documents { user: caller, doc-id: doc-id }
      {
        hash: hash,
        cid: cid,
        timestamp: block-height,
        doc-type: doc-type,
        metadata: metadata,
        owner: caller,
        status: true,
        version: u1,
        expiry: expiry,
        size: size,
        location: location,
        currency: currency,
        doc-name: doc-name,
        description: description,
        category: category,
        tags: tags,
        access-level: access-level,
        encryption-type: encryption-type,
        verifier: verifier,
        signature: signature,
        proof: proof
      }
    )
    (map-set docs-by-hash hash { user: caller, doc-id: doc-id })
    (map-set user-doc-counts caller (+ user-count u1))
    (var-set next-doc-id (+ doc-id u1))
    (var-set doc-count (+ (var-get doc-count) u1))
    (print { event: "document-backed-up", id: doc-id, user: caller })
    (ok doc-id)
  )
)

(define-public (update-document
  (doc-id uint)
  (new-hash (buff 32))
  (new-cid (string-ascii 46))
  (new-metadata (string-utf8 256))
  (update-reason (string-utf8 100))
)
  (let ((caller tx-sender)
        (doc (map-get? documents { user: caller, doc-id: doc-id })))
    (match doc
      d
        (begin
          (asserts! (is-eq (get owner d) caller) (err ERR-NOT-AUTHORIZED))
          (try! (validate-hash new-hash))
          (try! (validate-cid new-cid))
          (try! (validate-metadata new-metadata))
          (asserts! (not (is-eq (get hash d) new-hash)) (err ERR-INVALID-UPDATE-PARAM))
          (let ((old-hash (get hash d)))
            (map-delete docs-by-hash old-hash)
            (map-set docs-by-hash new-hash { user: caller, doc-id: doc-id })
          )
          (map-set documents { user: caller, doc-id: doc-id }
            (merge d
              {
                hash: new-hash,
                cid: new-cid,
                metadata: new-metadata,
                timestamp: block-height,
                version: (+ (get version d) u1)
              }
            )
          )
          (map-set doc-updates { user: caller, doc-id: doc-id }
            {
              update-timestamp: block-height,
              updater: caller,
              old-hash: (get hash d),
              new-hash: new-hash,
              update-reason: update-reason
            }
          )
          (print { event: "document-updated", id: doc-id, user: caller })
          (ok true)
        )
      (err ERR-DOC-NOT-FOUND)
    )
  )
)

(define-public (delete-document (doc-id uint))
  (let ((caller tx-sender)
        (doc (map-get? documents { user: caller, doc-id: doc-id })))
    (match doc
      d
        (begin
          (asserts! (is-eq (get owner d) caller) (err ERR-NOT-AUTHORIZED))
          (map-delete documents { user: caller, doc-id: doc-id })
          (map-delete docs-by-hash (get hash d))
          (map-delete doc-updates { user: caller, doc-id: doc-id })
          (let ((user-count (get-user-doc-count caller)))
            (map-set user-doc-counts caller (- user-count u1))
          )
          (var-set doc-count (- (var-get doc-count) u1))
          (print { event: "document-deleted", id: doc-id, user: caller })
          (ok true)
        )
      (err ERR-DOC-NOT-FOUND)
    )
  )
)

(define-public (get-total-doc-count)
  (ok (var-get doc-count))
)

(define-public (check-doc-existence (hash (buff 32)))
  (ok (is-doc-registered hash))
)