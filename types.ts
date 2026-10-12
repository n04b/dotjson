export type ScalarKind = "string" | "int" | "float" | "url" | "email" | "host";

export type VarType =
  | { kind: "string" }
  | { kind: "int" | "float"; min?: number; max?: number }
  | { kind: "bool" }
  // "port" is a number between 1 and 65535
  // "duration" is a string like "5s", "1h", etc. (Golang Duration String)
  | { kind: "email" | "port" | "duration" | "host" };

// Restricts a rule to a set of environments: either an allowlist or a denylist, never both
export type EnvCondition<Environment extends string> =
  | { in: Environment[]; notIn?: never }
  | { notIn: Environment[]; in?: never };

export type ValueEncryptedBase = {
  kind: "encrypted";
  algorithm?: "aes-256-gcm";
  keyId?: string; // optional key ID for key rotation, if not provided the default key is used
};

// Value stored encrypted in the config, decrypted at load time
export type ValueEncrypted =
  | (ValueEncryptedBase & { state: "encrypted" }) // value already encrypted and stored in the blob, value is not needed
  | (ValueEncryptedBase & { state: "pending"; valueToEncrypt: string }); // will be encrypted at processing time

export type Value = string | number | boolean | ValueEncrypted;

// Definition of a single environment variable
export interface Variable<Environment extends string> {
  description?: string;
  type: VarType;

  value?: Value; // shared value for all environments
  values?: Partial<Record<Environment, Value>>; // per-environment overrides, take precedence over value

  // Whether the variable must be set.
  // true — required in every environment; false — optional everywhere;
  // EnvCondition — required only in the matching environments, e.g. { in: ["production"] }
  // `true` by default
  required?: boolean | EnvCondition<Environment>;

  // Whether an empty string ("") counts as a valid value.
  // Same forms as `required`; e.g. { notIn: ["production"] } allows empty values outside production
  // `false` by default
  allowEmpty?: boolean | EnvCondition<Environment>;

  example?: string; // for .env.example and docs

  // All "secrets" (sensitive values) must be stored encrypted in the config, and decrypted at load time.
  // Non local, test or dev environments should never have secrets in plaintext and utility should warn and/or fail if it detects plaintext secrets in those environments.
  sensitivity?: "public" | "internal" | "secret";
  exposure?: "server" | "client" | "build";

  group?: string; // "database", "payments" — for UI and docs
  tags?: string[];
  aliases?: string[]; // old names after a rename
  deprecated?: { since?: string; replacedBy?: string; message?: string };
}

export type Configuration<Environment extends string> = {
  version: 1;
  environments: readonly Environment[];
  variables: Record<string, Variable<Environment>>; // keyed by variable name
};
