# TODO

- [ ] In strict mode the fields `description`, `type`, `value`/`values`, `required`, `allowEmpty`, `sensitivity`, `exposure` are mandatory.
- [ ] Add `value` `kind` concordance type check.

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

# Types

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