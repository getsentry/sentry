/**
 * Check that a value is a valid Date object, that doesn't point to NaN
 *
 * https://stackoverflow.com/questions/1353684/detecting-an-invalid-date-date-instance-in-javascript
 */
export default function isValidDate(d: unknown): d is Date {
  return d instanceof Date && !isNaN(d.getTime());
}
