import uniqBy from 'lodash/uniqBy';

import {
  isVisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';

export function getVisualizeTimeseriesQueries(
  visualizes: readonly Visualize[],
  transformationsEnabled: boolean
) {
  return uniqBy(
    visualizes.map(visualize => ({
      yAxis: visualize.yAxis,
      transformations:
        transformationsEnabled && isVisualizeFunction(visualize)
          ? visualize.transformations
          : [],
    })),
    query => JSON.stringify([query.yAxis, query.transformations])
  );
}
