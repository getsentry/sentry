/**
 * Drawing grid in rectangular coordinates
 *
 * e.g. alignment of your chart?
 */
export default function Grid(props = {}) {
  return {
    top: 24,

    // Is this a decent default for X-axis labels?
    bottom: 40,

    // This should allow for sufficient space for Y-axis labels
    left: '10%',

    right: '10%',
  };
}
