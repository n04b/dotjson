import type { Configuration } from "./types";

const environments = ["development", "staging", "production"] as const;
type Env = (typeof environments)[number];

export const config: Configuration<Env> = {
  version: 1,
  environments,
  variables: {
    PORT: {
      type: { kind: "port" },
      values: {
        development: 3000,
        staging: 80,
        production: 80
      }
    }
  },
};
