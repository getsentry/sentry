/**
 * Strips ANSI escape codes from a string
 * @param input - The string potentially containing ANSI codes
 * @returns The cleaned string without ANSI codes
 */
export function stripAnsi(input: string): string {
  // eslint-disable-next-line no-control-regex
  const ansiRegex = /\x1B(?:[@-Z\\-_]|\[[0-?]*[ -/]*[@-~])/g;
  return input.replace(ansiRegex, '');
}
