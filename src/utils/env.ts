const ENV_VAR_REGEX = /\$\{([^}]+)\}/g;

/**
 * Interpolate ${VAR} patterns in a string with process.env values.
 * Missing vars are left as-is.
 */
export function interpolateEnv(input: string): string {
  return input.replace(ENV_VAR_REGEX, (_match, varName) => {
    const value = process.env[varName];
    return value !== undefined ? value : _match;
  });
}

/**
 * Find env vars that start with the given prefix.
 */
export function findEnvVars(prefix: string): string[] {
  const p = prefix.toLowerCase();
  return Object.keys(process.env).filter((k) => k.toLowerCase().startsWith(p));
}


