/**
 * Turn a snake_case wire value into something readable: underscores become
 * spaces, and the first letter is capitalized.
 *
 * Meant for values from an open set — an API can introduce one before the
 * frontend knows its name — where showing the raw value imperfectly beats
 * dropping it. A value the frontend does recognize should get a translated
 * label instead; this is the fallback for the ones it does not.
 *
 * @example humanize('reauth_required') // 'Reauth required'
 */
export function humanize(value: string): string {
  return value.replaceAll('_', ' ').replace(/^./, character => character.toUpperCase());
}
