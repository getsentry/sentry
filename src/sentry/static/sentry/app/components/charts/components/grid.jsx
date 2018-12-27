/**
 * Drawing grid in rectangular coordinates
 *
 * e.g. alignment of your chart?
 */
export default function Grid(props = {}) {
  return {
    top: 20,
    bottom: 20,
    // This should allow for sufficient space for Y-axis labels
    left: '0%',
    right: '0%',
    padding: 0,
    itemGap: 25,
    containLabel: true,
    ...props,
  };
}
