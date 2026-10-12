# TODO

- [ ] In strict mode the fields `description`, `type`, `value`/`values`, `required`, `allowEmpty`, `sensitivity`, `exposure` are mandatory.
- [ ] Add `value` `kind` concordance type check.
- [ ] Different encryption keys for different environments 

## Runtime checks

Taking all decisions into account, the validator needs to check:
- [ ] the JS type of the value matches `kind` (`number` → `int`/`float`/`port`, `boolean` → `bool`);
- [ ] the value satisfies the type constraints (`min`, `max`, `pattern`, `enum` `values`, etc.);
- [ ] keys in `values` and environments in `EnvCondition` are listed in `environments`;
- [ ] `environments` has no duplicates;
- [ ] the JSON has no duplicate variable keys;
- [ ] `deprecated` together with `required` is an error;
- [ ] `seed` on a variable with `sensitivity: "secret"` is an error;
- [ ] `sensitivity: "secret"` together with `exposure: "client"` is an error;
- [ ] in strict mode all mandatory fields are set.
- [ ] all "secrets" (sensitive values) must be stored encrypted in the config, and decrypted at load time.

## Utility

- [ ] Import: extract variables and values from an existing `.env` file into the config.
- [ ] Export: unpack the config and decrypt secrets into a `.env` file.
- [ ] Export secrets to GitHub Actions secrets and other services.
- [ ] Generate encryption keys.
- [ ] Encrypt secrets in the config.
- [ ] Rotate keys: generate new keys (shared and per-environment) and re-encrypt the whole config with them.
- [ ] Optional: encrypt all values with a shared key before they are pushed to git (via a git hook). This is an extra layer on top of, not a replacement for, encrypting secrets with per-environment keys.
- [ ] Two distributions: a CLI utility and a Docker image.
  - [ ] The Docker image works as an init container: it pulls the latest config with encrypted secrets from git and unpacks/decrypts it; other containers depend on it and start only after it finishes.
  - [ ] Download config from alternative resources

## Encryption

> **Undecided.** The key model (shared key vs per-environment keys) and the overall encryption architecture are not settled yet; the items below may change. Still thinking through the design and its potential problems.

Open questions:
- [ ] Is a shared key needed at all, or are per-environment keys enough? Per-environment keys plus AAD and seals cover tampering; the shared key only adds hiding the config structure, at the cost of unreadable diffs, harder merges and one more key to distribute and rotate.
- [ ] Granularity: encrypt each value separately (needs `ValueEncrypted` or an `enc:v1:<keyId>:<base64>` string, per-value AAD and a separate seal) or encrypt all values of an environment as one block (`values.<env>.enc`; no `ValueEncrypted` and no seal, but values move out of the schema and diffs show only that the block changed).
- [ ] Symmetric vs asymmetric keys: with symmetric keys anyone who can add a secret can also read it; with asymmetric keys anyone with the public key can forge values, so signatures are needed.
- [ ] How keys are identified (`keyId`), stored and delivered to the CLI and the init container.
- [ ] Rollback protection: where the trusted "latest version" comes from (`DOTJSON_MIN_VERSION` in the deployment, a pinned signed tag, state on a volume, `expiresAt`).
- [ ] Shared `value` of a secret: it is expanded per environment and encrypted with each environment key; how to handle adding a new environment and keeping the copies in sync.

- [ ] Bind each encrypted value to its context with AES-GCM associated data (AAD): `JSON.stringify(["dotjson/1", name, environment, sensitivity, exposure])`.
  - Swapping ciphertexts between variables or editing `sensitivity`/`exposure` makes decryption fail.
  - Encode the AAD unambiguously (a JSON array, not `a:b:c` concatenation); `"dotjson/1"` is the format version.
  - Renaming a variable or changing its `sensitivity`/`exposure` requires re-encrypting the value, so only holders of that environment's key can do it.
- [ ] Per-environment seal, authenticated with the environment key:
  ```ts
  seals?: Partial<Record<Environment, {
    version: number;    // incremented on every change to the environment
    expiresAt?: string; // the seal is invalid after this date
    mac: string;        // HMAC(env key, version + expiresAt + names and hashes of all values in the environment)
  }>>;
  ```
  - Detects removed variables and encrypted values replaced with plaintext, which AAD alone does not catch.
  - Provides the version counter for rollback protection.

## Types

- [ ] Implement refrence values
```Typescript
export interface ValueReference {
kind: "reference";
provider: "vault" | "aws-secrets-manager" | "gcp-secret-manager" | "1password";
path: string; // secret location in the provider, e.g. "secret/data/db" or "op://vault/item"
field?: string; // field inside a multi-field secret; whole secret if omitted
version?: string; // pinned secret version; latest if omitted
}
```

- [ ] Implement generated values
```Typescript
export interface ValueGeneratedBase {
seed?: string; // same seed → same value
}

export interface RandomGen extends ValueGeneratedBase {
kind: "random";
length: number;
charset?: string; // characters to pick from
}

export interface UuidGen extends ValueGeneratedBase {
kind: "uuid";
}

export type ValueGenerated = RandomGen | UuidGen;
```

- [ ] Implement additional VarType kinds
```Typescript
type VarType =
  | { kind: "enum"; values: string[]; ignoreCase?: boolean } // case-sensitive by default
  | { kind: "url"; protocols?: string[] } // ["https", "postgres"]
  | { kind: "list"; of: ScalarKind; separator?: string }; // "a,b,c"
```

- [ ] Implement additional `string` VarType properties
```Typescript
export type VarType =
  | { kind: "string"; minLength?: number; maxLength?: number; pattern?: string; startsWith?: string } // pattern follows JS RegExp syntax, must match the whole value, "u" flag
```