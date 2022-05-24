/**
 * Given a list of objects (or maps) of `string` -> `any[]`,
 * merge the arrays of each key in the object.
 *
 * e.g. [{a: [1]}, {a: [2]}, {b: [3]}] ==> {a: [1, 2], b: {3}}
 *
 * Any non-array values will throw an exception
 */
export default function flattenListOfObjects(objs: Array<Record<string, any[]>>) {
  return objs.reduce((acc, obj) => {
    Object.entries(obj).forEach(([key, value]) => {
      if (!Array.isArray(value)) {
        throw new Error('Invalid value');
      }

      if (!acc[key]) {
        acc[key] = [];
      }

      acc[key] = acc[key].concat(value);
    });

    return acc;
  }, {});
}
