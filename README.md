# dotjson

A typed schema for describing environment variables in one place: their types, per-environment values, secrets and metadata.

> **Status:** early design. The repo currently contains only the TypeScript types; the validator and loader are not implemented yet — see [TODO.md](TODO.md).

## Example

```ts
import type { Configuration } from "./types";

const environments = ["development", "staging", "production"] as const;
type Env = (typeof environments)[number];

export const config: Configuration<Env> = {
  version: 1,
  environments,
  variables: {
    PORT: {
      type: { kind: "port" },
      value: 80,
      values: { development: 3000 },
    },

    LOG_LEVEL: {
      type: { kind: "enum", values: ["debug", "info", "warn", "error"] },
      value: "info",
      values: { development: "debug" },
      required: false,
    },

    DATABASE_URL: {
      description: "Primary Postgres connection string",
      type: { kind: "url", protocols: ["postgres"] },
      sensitivity: "secret",
      group: "database",
      values: {
        development: "postgres://localhost:5432/app",
        production: { kind: "reference", provider: "vault", path: "secret/data/db", field: "url" },
      },
    },

    SESSION_SECRET: {
      type: { kind: "string", minLength: 32 },
      sensitivity: "secret",
      values: {
        development: { kind: "random", length: 32, seed: "dev" },
        production: { kind: "encrypted", ciphertext: "q3J0...==" },
      },
    },
  },
};
```

## Configuration

| Field | Description |
|---|---|
| `version` | Schema version, currently `1` |
| `environments` | All environment names, e.g. `["development", "production"]` |
| `variables` | Variable definitions keyed by variable name |

## Variable

| Field | Description |
|---|---|
| `type` | Value type and its constraints (see [Types](#types)) |
| `description` | Human-readable description |
| `value` | Value shared by all environments |
| `values` | Per-environment overrides; take precedence over `value` |
| `required` | Whether the variable must be set. Default `true` |
| `allowEmpty` | Whether `""` is a valid value. Default `false` |
| `example` | Sample value for `.env.example` and docs |
| `sensitivity` | `"public"` \| `"internal"` \| `"secret"` |
| `exposure` | Where the value is available: `"server"` \| `"client"` \| `"build"` |
| `group` | Grouping for UI and docs, e.g. `"database"` |
| `tags` | Free-form tags |
| `aliases` | Old names kept after a rename |
| `deprecated` | `{ since?, replacedBy?, message? }` |

`required` and `allowEmpty` accept either a boolean or an environment condition:

```ts
required: { in: ["production"] }        // required only in production
allowEmpty: { notIn: ["production"] }   // empty allowed everywhere except production
```

## Types

| `kind` | Options |
|---|---|
| `string` | `minLength`, `maxLength`, `pattern` (JS RegExp, full match, `u` flag), `startsWith` |
| `int`, `float` | `min`, `max` |
| `bool` | — |
| `enum` | `values`, `ignoreCase` (case-sensitive by default) |
| `url` | `protocols`, e.g. `["https", "postgres"]` |
| `email`, `port`, `duration`, `host` | — |
| `list` | `of` (scalar kind), `separator` — e.g. `"a,b,c"` |

## Values

A value is either a literal (`string`, `number`, `boolean`) or one of:

- **Generated**: `{ kind: "random", length, charset? }` or `{ kind: "uuid" }`. An optional `seed` makes the result deterministic.
- **Encrypted**: `{ kind: "encrypted", ciphertext, algorithm? }`. `ciphertext` is base64 of IV + encrypted data + auth tag; the algorithm defaults to `aes-256-gcm`.
- **Reference**: `{ kind: "reference", provider, path, field?, version? }`. The value lives in an external secret manager (`vault`, `aws-secrets-manager`, `gcp-secret-manager`, `1password`).
