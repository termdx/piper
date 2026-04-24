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
 * Check if a string contains unresolved ${VAR} patterns.
 */
export function hasEnvVars(input: string): boolean {
  return ENV_VAR_REGEX.test(input);
}

/**
 * Get all env var names referenced in a string.
 */
export function extractEnvVars(input: string): string[] {
  const vars: string[] = [];
  let match: RegExpExecArray | null;
  const regex = new RegExp(ENV_VAR_REGEX.source, "g");
  while ((match = regex.exec(input)) !== null) {
    vars.push(match[1]!);
  }
  return vars;
}

/**
 * Find env vars that start with the given prefix.
 */
export function findEnvVars(prefix: string): string[] {
  const p = prefix.toLowerCase();
  return Object.keys(process.env).filter((k) => k.toLowerCase().startsWith(p));
}

/**
 * Get the value of an env var, or undefined if not set.
 */
export function getEnvVar(name: string): string | undefined {
  return process.env[name];
}
