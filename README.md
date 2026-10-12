# loudTSSS

Typed environment config in one file: variable types, per-environment values, encrypted secrets and metadata. Secrets stay quiet, errors stay loud.

> **Status:** early design. The repo currently contains only the TypeScript types ([types.ts](types.ts)); the validator, the loader and the CLI are not implemented yet. See [TODO.md](TODO.md) for the plan.

> [!WARNING]
> **Before you start working with an encrypted config** (planned workflow, the utility is not implemented yet):
>
> 1. **Ignore the working file.** Add the unpacked working config and every file the utility exports (e.g. `.env`) to `.gitignore`. They contain decrypted values and must never reach git.
> 2. **Install the git hooks.** They check that the committed (encrypted) file is up to date and that it is committed on its own, without other files. Hooks run only locally, so the same checks must also run in CI.
> 3. **Get the key for your environment only.** Store it outside the repository and never commit it. You do not need, and should not have, keys for environments you do not work with.
> 4. **Unpack before editing.** Unpack the config for your environment and edit only the working file; never edit the encrypted blocks by hand.
> 5. **Do not bypass the safeguards.** Never use `git commit --no-verify` or `git add -f` on the working file.

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

    REQUEST_TIMEOUT: {
      description: "Timeout for outgoing HTTP requests",
      type: { kind: "duration" },
      value: "5s",
      values: { development: "30s" },
    },

    WORKERS: {
      type: { kind: "int", min: 1, max: 64 },
      value: 4,
      required: { in: ["production"] },
    },

    SUPPORT_EMAIL: {
      type: { kind: "email" },
      value: "support@example.com",
      sensitivity: "public",
      exposure: "client",
    },

    DATABASE_URL: {
      description: "Primary Postgres connection string",
      type: { kind: "string" },
      sensitivity: "secret",
      exposure: "server",
      group: "database",
      values: {
        development: "postgres://localhost:5432/app",
        staging: { kind: "encrypted", state: "pending", valueToEncrypt: "postgres://staging-db:5432/app" },
        production: { kind: "encrypted", state: "encrypted", keyId: "prod-2026-10" },
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
| `blob` | Encrypted values, one block per environment: `{ production: "enc:v1:<keyId>:<base64>", ... }`. Each block is encrypted with its environment's key (see [Encryption](#encryption-planned)) |

## Variable

| Field | Description |
|---|---|
| `type` | Value type and its constraints (see [Types](#types)). Required |
| `description` | Human-readable description |
| `value` | Value shared by all environments |
| `values` | Per-environment overrides; take precedence over `value` |
| `required` | Whether the variable must be set. Default `true` |
| `allowEmpty` | Whether `""` is a valid value. Default `false` |
| `example` | Sample value for `.env.example` and docs |
| `sensitivity` | `"public"` \| `"internal"` \| `"secret"`. Secrets must be stored encrypted outside local and dev environments |
| `exposure` | Where the value is available: `"server"` \| `"client"` \| `"build"` |
| `group` | Grouping for UI and docs, e.g. `"database"` |
| `tags` | Free-form tags |
| `aliases` | Old names kept after a rename |
| `deprecated` | `{ since?, replacedBy?, message? }` |

`required` and `allowEmpty` accept either a boolean or an environment condition, an allowlist (`in`) or a denylist (`notIn`), never both:

```ts
required: { in: ["production"] }        // required only in production
allowEmpty: { notIn: ["production"] }   // empty allowed everywhere except production
```

## Types

| `kind` | Options | Value |
|---|---|---|
| `string` | — | any string |
| `int`, `float` | `min`, `max` | number |
| `bool` | — | boolean |
| `port` | — | number from 1 to 65535 |
| `duration` | — | Go duration string, e.g. `"5s"`, `"1h"` |
| `email`, `host` | — | string |

## Values

A value is either a literal (`string`, `number`, `boolean`) or an encrypted value.

An encrypted value is `{ kind: "encrypted", state, algorithm?, keyId? }`:

| Field | Description |
|---|---|
| `state` | `"encrypted"`: the value is already encrypted and stored in the environment's encrypted block, so the entry carries no value. `"pending"`: the value is still plaintext in `valueToEncrypt` and will be encrypted on the next run |
| `valueToEncrypt` | Plaintext to encrypt; only with `state: "pending"` |
| `algorithm` | `"aes-256-gcm"`, the default and currently the only option |
| `keyId` | Key used for this value, for key rotation; the default key if omitted |

`state` has no default, so an entry without it is never mistaken for plaintext.

## Encryption (planned)

The config exists in two forms:

- **Committed file**, stored in git: the schema (variables with their metadata, without values) plus one encrypted block per environment. A block holds **all** values of its environment, public and secret, and is encrypted with that environment's key. Nobody can swap, remove or replace a value without the key.
- **Working file**, ignored by git: the config unpacked for one environment. Non-secret values are decrypted into place; secrets stay in the block and appear as `{ kind: "encrypted", state: "encrypted" }`.

To add a secret by hand, write it into the working file as `{ kind: "encrypted", state: "pending", valueToEncrypt: "..." }`. The utility moves it into the block and replaces the entry with `{ kind: "encrypted", state: "encrypted" }`.

The key model (symmetric or asymmetric keys, delivery, rotation) and rollback protection are still open questions; see [TODO.md](TODO.md#encryption).

## Planned

Not in [types.ts](types.ts) yet; see [TODO.md](TODO.md):

- **More types:** `enum` (`values`, `ignoreCase`), `url` (`protocols`), `list` (`of`, `separator`), and `string` constraints (`minLength`, `maxLength`, `pattern`, `startsWith`).
- **Generated values:** `{ kind: "random", length, charset? }` and `{ kind: "uuid" }`, with an optional `seed` for a deterministic result.
- **References:** `{ kind: "reference", provider, path, field?, version? }` for values stored in an external secret manager (`vault`, `aws-secrets-manager`, `gcp-secret-manager`, `1password`).
- **Utility:** a CLI and a Docker image (an init container that fetches and decrypts the config before other containers start), import from and export to `.env`, key generation and rotation.
- **Docs:** [generating environment variables in Docker Compose](docs/docker-compose-env-generation.md).
