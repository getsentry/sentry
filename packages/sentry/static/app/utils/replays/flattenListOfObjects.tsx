/**
 * Given a list of objects (or maps) of `string` -> `any[]`,
 * merge the arrays of each key in the object.
 *
 * e.g. [{a: [1]}, {a: [2]}, {b: [3]}] ==> {a: [1, 2], b: {3}}
 *
 * Any non-array values will throw an exception
 */
export default function flattenListOfObjects(
  objs: Array<Record<string, any[] | undefined>>
) {
  return objs.reduce((acc, obj) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (!Array.isArray(value)) {
        // e.g. if value is undefined (otherwise, a non-Array type will get caught by ts)
        // TS doesn't like our test where object keys are no equivalent, so we
        // need to allow `undefined` as a valid type in the Record.
        throw new Error('Invalid value');
      }

      acc[key] = (acc[key] || []).concat(value);
    });

    return acc;
  }, {});
}
