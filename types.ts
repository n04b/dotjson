export type ScalarKind = "string" | "int" | "float" | "url" | "email" | "host";

export type VarType =
  | { kind: "string"; minLength?: number; maxLength?: number; pattern?: string; startsWith?: string } // pattern follows JS RegExp syntax, must match the whole value, "u" flag
  | { kind: "int" | "float"; min?: number; max?: number }
  | { kind: "bool" }
  | { kind: "enum"; values: string[]; ignoreCase?: boolean } // case-sensitive by default
  | { kind: "url"; protocols?: string[] } // ["https", "postgres"]
  | { kind: "email" | "port" | "duration" | "host" }
  | { kind: "list"; of: ScalarKind; separator?: string }; // "a,b,c"

// Restricts a rule to a set of environments: either an allowlist or a denylist, never both
export type EnvCondition<Environment extends string> =
  | { in: Environment[]; notIn?: never }
  | { notIn: Environment[]; in?: never };

export interface GenerateBase {
  seed?: string; // same seed → same value
}

export interface RandomGen extends GenerateBase {
  kind: "random";
  length: number;
  charset?: string; // characters to pick from
}

export interface UuidGen extends GenerateBase {
  kind: "uuid";
}

export type Generate = RandomGen | UuidGen;

export type Value = string | number | boolean | Generate;

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
  variables: Record<string, Variable<Environment>>;  // keyed by variable name
}
