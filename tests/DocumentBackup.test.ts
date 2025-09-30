import { describe, it, expect, beforeEach } from "vitest";
import {
  stringUtf8CV,
  uintCV,
  stringAsciiCV,
  principalCV,
  bufferCV,
  listCV,
  someCV,
  ClarityType,
} from "@stacks/transactions";

const ERR_INVALID_HASH = 101;
const ERR_INVALID_CID = 102;
const ERR_INVALID_DOC_TYPE = 103;
const ERR_INVALID_METADATA = 105;
const ERR_DOC_ALREADY_EXISTS = 106;
const ERR_USER_NOT_REGISTERED = 108;
const ERR_MAX_DOCS_EXCEEDED = 112;
const ERR_AUTHORITY_NOT_SET = 119;
const ERR_INVALID_EXPIRY = 115;
const ERR_INVALID_SIZE = 116;
const ERR_INVALID_LOCATION = 117;
const ERR_INVALID_CURRENCY = 118;
const ERR_INVALID_DOC_NAME = 122;
const ERR_INVALID_DESCRIPTION = 123;
const ERR_INVALID_CATEGORY = 124;
const ERR_INVALID_TAGS = 125;
const ERR_INVALID_ACCESS_LEVEL = 126;
const ERR_INVALID_ENCRYPTION_TYPE = 127;
const ERR_NOT_AUTHORIZED = 100;
const ERR_DOC_NOT_FOUND = 107;
const ERR_INVALID_UPDATE_PARAM = 113;

interface Document {
  hash: Uint8Array;
  cid: string;
  timestamp: number;
  docType: string;
  metadata: string;
  owner: string;
  status: boolean;
  version: number;
  expiry: number | null;
  size: number;
  location: string;
  currency: string;
  docName: string;
  description: string;
  category: string;
  tags: string[];
  accessLevel: number;
  encryptionType: string;
  verifier: string | null;
  signature: Uint8Array | null;
  proof: Uint8Array | null;
}

interface DocUpdate {
  updateTimestamp: number;
  updater: string;
  oldHash: Uint8Array;
  newHash: Uint8Array;
  updateReason: string;
}

interface Result<T> {
  ok: boolean;
  value: T | number;
}

class DocumentBackupMock {
  state: {
    nextDocId: number;
    maxDocsPerUser: number;
    backupFee: number;
    authorityContract: string | null;
    docCount: number;
    documents: Map<string, Document>;
    docUpdates: Map<string, DocUpdate>;
    docsByHash: Map<string, { user: string; docId: number }>;
    userDocCounts: Map<string, number>;
  } = {
    nextDocId: 1,
    maxDocsPerUser: 50,
    backupFee: 500,
    authorityContract: null,
    docCount: 0,
    documents: new Map(),
    docUpdates: new Map(),
    docsByHash: new Map(),
    userDocCounts: new Map(),
  };
  blockHeight: number = 0;
  caller: string = "ST1TEST";
  registeredUsers: Set<string> = new Set(["ST1TEST"]);
  stxTransfers: Array<{ amount: number; from: string; to: string | null }> = [];

  constructor() {
    this.reset();
  }

  reset() {
    this.state = {
      nextDocId: 1,
      maxDocsPerUser: 50,
      backupFee: 500,
      authorityContract: null,
      docCount: 0,
      documents: new Map(),
      docUpdates: new Map(),
      docsByHash: new Map(),
      userDocCounts: new Map(),
    };
    this.blockHeight = 0;
    this.caller = "ST1TEST";
    this.registeredUsers = new Set(["ST1TEST"]);
    this.stxTransfers = [];
  }

  isRegistered(user: string): boolean {
    return this.registeredUsers.has(user);
  }

  setAuthorityContract(contractPrincipal: string): Result<boolean> {
    if (contractPrincipal === "SP000000000000000000002Q6VF78") {
      return { ok: false, value: ERR_NOT_AUTHORIZED };
    }
    if (this.state.authorityContract !== null) {
      return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    }
    this.state.authorityContract = contractPrincipal;
    return { ok: true, value: true };
  }

  setMaxDocsPerUser(newMax: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (newMax <= 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.maxDocsPerUser = newMax;
    return { ok: true, value: true };
  }

  setBackupFee(newFee: number): Result<boolean> {
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };
    if (newFee < 0) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };
    this.state.backupFee = newFee;
    return { ok: true, value: true };
  }

  backupDocument(
    hash: Uint8Array,
    cid: string,
    docType: string,
    metadata: string,
    expiry: number | null,
    size: number,
    location: string,
    currency: string,
    docName: string,
    description: string,
    category: string,
    tags: string[],
    accessLevel: number,
    encryptionType: string,
    verifier: string | null,
    signature: Uint8Array | null,
    proof: Uint8Array | null
  ): Result<number> {
    const userCount = this.state.userDocCounts.get(this.caller) || 0;
    if (userCount >= this.state.maxDocsPerUser) return { ok: false, value: ERR_MAX_DOCS_EXCEEDED };
    if (!this.isRegistered(this.caller)) return { ok: false, value: ERR_USER_NOT_REGISTERED };
    if (hash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (cid.length === 0 || cid.length > 46) return { ok: false, value: ERR_INVALID_CID };
    if (!["passport", "license", "certificate", "id-card"].includes(docType))
      return { ok: false, value: ERR_INVALID_DOC_TYPE };
    if (metadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (expiry !== null && expiry <= this.blockHeight) return { ok: false, value: ERR_INVALID_EXPIRY };
    if (size > 10485760) return { ok: false, value: ERR_INVALID_SIZE };
    if (location.length > 100) return { ok: false, value: ERR_INVALID_LOCATION };
    if (!["STX", "USD", "BTC"].includes(currency)) return { ok: false, value: ERR_INVALID_CURRENCY };
    if (docName.length === 0 || docName.length > 100) return { ok: false, value: ERR_INVALID_DOC_NAME };
    if (description.length > 200) return { ok: false, value: ERR_INVALID_DESCRIPTION };
    if (category.length > 50) return { ok: false, value: ERR_INVALID_CATEGORY };
    if (tags.length > 10) return { ok: false, value: ERR_INVALID_TAGS };
    if (accessLevel > 3) return { ok: false, value: ERR_INVALID_ACCESS_LEVEL };
    if (!["AES", "RSA", "ECC"].includes(encryptionType)) return { ok: false, value: ERR_INVALID_ENCRYPTION_TYPE };
    const hashKey = hash.toString();
    if (this.state.docsByHash.has(hashKey)) return { ok: false, value: ERR_DOC_ALREADY_EXISTS };
    if (!this.state.authorityContract) return { ok: false, value: ERR_AUTHORITY_NOT_SET };

    this.stxTransfers.push({ amount: this.state.backupFee, from: this.caller, to: this.state.authorityContract });

    const id = this.state.nextDocId;
    const key = `${this.caller}-${id}`;
    const document: Document = {
      hash,
      cid,
      timestamp: this.blockHeight,
      docType,
      metadata,
      owner: this.caller,
      status: true,
      version: 1,
      expiry,
      size,
      location,
      currency,
      docName,
      description,
      category,
      tags,
      accessLevel,
      encryptionType,
      verifier,
      signature,
      proof,
    };
    this.state.documents.set(key, document);
    this.state.docsByHash.set(hashKey, { user: this.caller, docId: id });
    this.state.userDocCounts.set(this.caller, userCount + 1);
    this.state.nextDocId++;
    this.state.docCount++;
    return { ok: true, value: id };
  }

  getDocument(user: string, docId: number): Document | null {
    const key = `${user}-${docId}`;
    return this.state.documents.get(key) || null;
  }

  updateDocument(docId: number, newHash: Uint8Array, newCid: string, newMetadata: string, updateReason: string): Result<boolean> {
    const key = `${this.caller}-${docId}`;
    const doc = this.state.documents.get(key);
    if (!doc) return { ok: false, value: ERR_DOC_NOT_FOUND };
    if (doc.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };
    if (newHash.length !== 32) return { ok: false, value: ERR_INVALID_HASH };
    if (newCid.length === 0 || newCid.length > 46) return { ok: false, value: ERR_INVALID_CID };
    if (newMetadata.length > 256) return { ok: false, value: ERR_INVALID_METADATA };
    if (newHash.toString() === doc.hash.toString()) return { ok: false, value: ERR_INVALID_UPDATE_PARAM };

    const oldHashKey = doc.hash.toString();
    const newHashKey = newHash.toString();
    this.state.docsByHash.delete(oldHashKey);
    this.state.docsByHash.set(newHashKey, { user: this.caller, docId });

    const updated: Document = {
      ...doc,
      hash: newHash,
      cid: newCid,
      metadata: newMetadata,
      timestamp: this.blockHeight,
      version: doc.version + 1,
    };
    this.state.documents.set(key, updated);
    this.state.docUpdates.set(key, {
      updateTimestamp: this.blockHeight,
      updater: this.caller,
      oldHash: doc.hash,
      newHash,
      updateReason,
    });
    return { ok: true, value: true };
  }

  deleteDocument(docId: number): Result<boolean> {
    const key = `${this.caller}-${docId}`;
    const doc = this.state.documents.get(key);
    if (!doc) return { ok: false, value: ERR_DOC_NOT_FOUND };
    if (doc.owner !== this.caller) return { ok: false, value: ERR_NOT_AUTHORIZED };

    const hashKey = doc.hash.toString();
    this.state.documents.delete(key);
    this.state.docsByHash.delete(hashKey);
    this.state.docUpdates.delete(key);
    const userCount = this.state.userDocCounts.get(this.caller) || 0;
    this.state.userDocCounts.set(this.caller, userCount - 1);
    this.state.docCount--;
    return { ok: true, value: true };
  }

  getTotalDocCount(): Result<number> {
    return { ok: true, value: this.state.docCount };
  }

  checkDocExistence(hash: Uint8Array): Result<boolean> {
    return { ok: true, value: this.state.docsByHash.has(hash.toString()) };
  }
}

describe("DocumentBackup", () => {
  let contract: DocumentBackupMock;

  beforeEach(() => {
    contract = new DocumentBackupMock();
    contract.reset();
  });

  it("backs up a document successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1", "tag2"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(true);
    expect(result.value).toBe(1);

    const doc = contract.getDocument("ST1TEST", 1);
    expect(doc?.hash).toEqual(hash);
    expect(doc?.cid).toBe("QmTestCID");
    expect(doc?.docType).toBe("passport");
    expect(doc?.metadata).toBe("meta data");
    expect(doc?.owner).toBe("ST1TEST");
    expect(doc?.status).toBe(true);
    expect(doc?.version).toBe(1);
    expect(doc?.expiry).toBe(null);
    expect(doc?.size).toBe(1024);
    expect(doc?.location).toBe("IPFS");
    expect(doc?.currency).toBe("STX");
    expect(doc?.docName).toBe("MyPassport");
    expect(doc?.description).toBe("Personal ID");
    expect(doc?.category).toBe("identity");
    expect(doc?.tags).toEqual(["tag1", "tag2"]);
    expect(doc?.accessLevel).toBe(1);
    expect(doc?.encryptionType).toBe("AES");
    expect(contract.stxTransfers).toEqual([{ amount: 500, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects duplicate document hashes", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(1);
    contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const result = contract.backupDocument(
      hash,
      "QmOtherCID",
      "license",
      "other meta",
      1000,
      2048,
      "S3",
      "USD",
      "MyLicense",
      "Driving Doc",
      "transport",
      ["tag3"],
      2,
      "RSA",
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      new Uint8Array(65),
      new Uint8Array(128)
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DOC_ALREADY_EXISTS);
  });

  it("rejects unregistered user", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.caller = "ST2FAKE";
    contract.registeredUsers = new Set();
    const hash = new Uint8Array(32).fill(2);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_USER_NOT_REGISTERED);
  });

  it("rejects backup without authority contract", () => {
    const hash = new Uint8Array(32).fill(3);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("rejects invalid hash length", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(31).fill(4);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_HASH);
  });

  it("rejects invalid document type", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(5);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "invalid",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DOC_TYPE);
  });

  it("updates a document successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const oldHash = new Uint8Array(32).fill(6);
    contract.backupDocument(
      oldHash,
      "QmOldCID",
      "passport",
      "old meta",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const newHash = new Uint8Array(32).fill(7);
    const result = contract.updateDocument(1, newHash, "QmNewCID", "new meta", "version update");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const doc = contract.getDocument("ST1TEST", 1);
    expect(doc?.hash).toEqual(newHash);
    expect(doc?.cid).toBe("QmNewCID");
    expect(doc?.metadata).toBe("new meta");
    expect(doc?.version).toBe(2);
    const update = contract.state.docUpdates.get("ST1TEST-1");
    expect(update?.oldHash).toEqual(oldHash);
    expect(update?.newHash).toEqual(newHash);
    expect(update?.updateReason).toBe("version update");
    expect(update?.updater).toBe("ST1TEST");
  });

  it("rejects update for non-existent document", () => {
    contract.setAuthorityContract("ST2TEST");
    const newHash = new Uint8Array(32).fill(8);
    const result = contract.updateDocument(99, newHash, "QmNewCID", "new meta", "update");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DOC_NOT_FOUND);
  });

  it("deletes a document successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(11);
    contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const result = contract.deleteDocument(1);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const doc = contract.getDocument("ST1TEST", 1);
    expect(doc).toBe(null);
    expect(contract.state.userDocCounts.get("ST1TEST")).toBe(0);
    expect(contract.state.docCount).toBe(0);
  });

  it("rejects delete for non-existent document", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.deleteDocument(99);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_DOC_NOT_FOUND);
  });

  it("sets backup fee successfully", () => {
    contract.setAuthorityContract("ST2TEST");
    const result = contract.setBackupFee(1000);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.backupFee).toBe(1000);
    const hash = new Uint8Array(32).fill(12);
    contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(contract.stxTransfers).toEqual([{ amount: 1000, from: "ST1TEST", to: "ST2TEST" }]);
  });

  it("rejects backup fee change without authority", () => {
    const result = contract.setBackupFee(1000);
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_AUTHORITY_NOT_SET);
  });

  it("returns correct total document count", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash1 = new Uint8Array(32).fill(13);
    contract.backupDocument(
      hash1,
      "QmTest1",
      "passport",
      "meta1",
      null,
      1024,
      "IPFS",
      "STX",
      "Doc1",
      "Desc1",
      "Cat1",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const hash2 = new Uint8Array(32).fill(14);
    contract.backupDocument(
      hash2,
      "QmTest2",
      "license",
      "meta2",
      1000,
      2048,
      "S3",
      "USD",
      "Doc2",
      "Desc2",
      "Cat2",
      ["tag2"],
      2,
      "RSA",
      "ST1PQHQKV0RJXZFY1DGX8MNSNYVE3VGZJSRTPGZGM",
      new Uint8Array(65),
      new Uint8Array(128)
    );
    const result = contract.getTotalDocCount();
    expect(result.ok).toBe(true);
    expect(result.value).toBe(2);
  });

  it("checks document existence correctly", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(15);
    contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "MyPassport",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const result = contract.checkDocExistence(hash);
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    const fakeHash = new Uint8Array(32).fill(16);
    const result2 = contract.checkDocExistence(fakeHash);
    expect(result2.ok).toBe(true);
    expect(result2.value).toBe(false);
  });

  it("rejects backup with empty document name", () => {
    contract.setAuthorityContract("ST2TEST");
    const hash = new Uint8Array(32).fill(17);
    const result = contract.backupDocument(
      hash,
      "QmTestCID",
      "passport",
      "meta data",
      null,
      1024,
      "IPFS",
      "STX",
      "",
      "Personal ID",
      "identity",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_INVALID_DOC_NAME);
  });

  it("rejects backup with max documents exceeded", () => {
    contract.setAuthorityContract("ST2TEST");
    contract.setMaxDocsPerUser(1);
    const hash1 = new Uint8Array(32).fill(18);
    contract.backupDocument(
      hash1,
      "QmTest1",
      "passport",
      "meta1",
      null,
      1024,
      "IPFS",
      "STX",
      "Doc1",
      "Desc1",
      "Cat1",
      ["tag1"],
      1,
      "AES",
      null,
      null,
      null
    );
    const hash2 = new Uint8Array(32).fill(19);
    const result = contract.backupDocument(
      hash2,
      "QmTest2",
      "license",
      "meta2",
      null,
      2048,
      "S3",
      "USD",
      "Doc2",
      "Desc2",
      "Cat2",
      ["tag2"],
      2,
      "RSA",
      null,
      null,
      null
    );
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_MAX_DOCS_EXCEEDED);
  });

  it("sets authority contract successfully", () => {
    const result = contract.setAuthorityContract("ST2TEST");
    expect(result.ok).toBe(true);
    expect(result.value).toBe(true);
    expect(contract.state.authorityContract).toBe("ST2TEST");
  });

  it("rejects invalid authority contract", () => {
    const result = contract.setAuthorityContract("SP000000000000000000002Q6VF78");
    expect(result.ok).toBe(false);
    expect(result.value).toBe(ERR_NOT_AUTHORIZED);
  });
});