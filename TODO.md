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
