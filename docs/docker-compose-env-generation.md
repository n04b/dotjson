# Generating environment variables in Docker Compose

Environment variables can be generated inside Docker Compose itself, without external Bash scripts. There are two main approaches; the choice depends on the goal:

- the generated values must **persist** and be available on the host as a file → [Option 1](#option-1-generate-a-env-file-with-an-init-service);
- the values can be **regenerated on every start** and never touch the disk → [Option 2](#option-2-generate-on-the-fly-inside-the-container).

## Option 1: Generate a `.env` file with an init service

A short-lived init container writes the file to a directory shared with the host. The main services wait for it to finish and then read the file.

```yaml
services:
  # 1. Init service: creates secrets/.env if it does not exist
  init-env:
    image: alpine:3.20
    volumes:
      - ./secrets:/secrets
    command:
      - sh
      - -c
      - |
        set -eu
        umask 077
        if [ -f /secrets/.env ]; then
          echo "/secrets/.env already exists, skipping"
          exit 0
        fi
        rand() { tr -dc 'A-Za-z0-9' < /dev/urandom | head -c "$$1"; }
        {
          echo "POSTGRES_USER=myuser"
          echo "POSTGRES_DB=mydb"
          echo "POSTGRES_PASSWORD=$$(rand 32)"
          echo "SECRET_KEY=$$(rand 48)"
        } > /secrets/.env.tmp
        mv /secrets/.env.tmp /secrets/.env

  # 2. Main service, e.g. a database
  postgres:
    image: postgres:16-alpine
    # Wait until the init service has finished successfully
    depends_on:
      init-env:
        condition: service_completed_successfully
    volumes:
      - ./secrets:/run/secrets:ro
      - pgdata:/var/lib/postgresql/data
    # Load the generated file at container start, then hand over to the image's entrypoint
    entrypoint:
      - sh
      - -c
      - |
        set -a
        . /run/secrets/.env
        set +a
        exec docker-entrypoint.sh postgres
    ports:
      - "127.0.0.1:5432:5432"

volumes:
  pgdata:
```

Add `secrets/` to `.gitignore`: the file contains plaintext secrets.

### Pitfalls

- **Do not use `env_file:` or `${VAR}` in `environment:` for a generated file.** Compose resolves both when it parses the project, before any container runs. On the first `docker compose up` the file does not exist yet: `env_file` fails, and `${DB_PASSWORD}` becomes an empty string. `environment:` also takes precedence over `env_file:`, so the empty value wins. The file must be read at **container start**, as in the `entrypoint` above.
- **Do not fall back to a hard-coded value.** A pattern such as `$(openssl rand -hex 16 || echo 'default_pass')` silently produces a well-known password whenever the generator fails. For example, the `alpine` image does not ship the `openssl` binary. Fail instead (`set -eu`).
- **Escape `$` as `$$`.** Compose interpolates `$VAR` and `${VAR}` from the host environment, so shell variables and command substitutions inside `command:` must be written as `$$1` and `$$(...)`.
- **Write atomically, with restrictive permissions.** `umask 077` makes the file readable only by its owner. Writing to a temporary file and then renaming it with `mv` means a crash never leaves a half-written `.env` that the next run would treat as complete.
- **Prefer `*_FILE` variables where the image supports them.** Many official images, including `postgres`, can read a secret from a file (`POSTGRES_PASSWORD_FILE`). Values loaded at runtime do not appear in `docker inspect`, unlike values set in `environment:`.

## Option 2: Generate on the fly inside the container

If no file is needed on the host, override the container's command to generate the value just before the application starts.

```yaml
services:
  # A web app that gets a fresh random SECRET_KEY on every start
  web-app:
    image: node:20-alpine
    working_dir: /app
    volumes:
      - ./:/app
    command:
      - sh
      - -c
      - |
        export SECRET_KEY="$$(head -c 32 /dev/urandom | base64)"
        exec node app.js
    ports:
      - "3000:3000"
```

### Pitfalls

- The value changes on **every container start**, including automatic restarts after a crash. All sessions and tokens signed with the previous key become invalid.
- With **several replicas**, each one generates its own key. A token issued by one replica fails verification on another. Use Option 1 or a shared secret store instead.

## Comparison

| Criterion | Option 1: `.env` file | Option 2: in memory |
|---|---|---|
| Persistence | Generated once; survives container restarts and re-creation | Regenerated on every container start |
| Where values live | In a plaintext file on the host (`secrets/.env`) | Only in the environment of the running process |
| Shared between services | Yes, every service that mounts the directory | No, each container has its own value |
| Suitable for | Database credentials and anything that must stay stable to keep data accessible | Session, cache or JWT signing keys that can be reset on restart, single replica only |

## Implications for loudTSSS

The planned Docker image ([TODO.md](../TODO.md), *Utility*) follows the Option 1 pattern: an init container that produces the decrypted values, with other services depending on it through `condition: service_completed_successfully`. The pitfalls above apply directly:

- dependent services must load the output **at container start**, not through `env_file:` or `${VAR}` interpolation;
- the decrypted file is plaintext on a shared mount. Every service that mounts it sees every value, so prefer one file per service, read-only mounts, `0600` permissions and a `tmpfs` volume over a host directory;
- the init container must fail loudly (non-zero exit) when it cannot fetch or decrypt the config, so that dependent services do not start with missing or default values.
