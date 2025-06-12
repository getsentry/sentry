/**
 * Typescript helper to assert that a value is of never type, useful for
 * ensuring exhaustivity of a switch statement or other type checks.
 *
 * @example
 * ```ts
 * function myFunction(x: 'foo' | 'bar') {
 *   switch (x) {
 *     case 'foo':
 *       break;
 *     default:
 *       return assertUnreachable(x); <-- this will throw a type error as x can still be 'bar'
 *   }
 * }
 * ```
 *
 * @param x - The value that should never be used.
 * @returns The value that was passed in.
 */
export function unreachable(x: never) {
  return x;
}
