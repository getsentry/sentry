import uniqBy from 'lodash/uniqBy';

import type {Visualize} from 'sentry/views/explore/queryParams/visualize';

export function getVisualizeTimeseriesQueries(
  visualizes: readonly Visualize[],
  transformationsEnabled: boolean
) {
  return uniqBy(
    visualizes.map(visualize => ({
      yAxis: visualize.yAxis,
      transformations: transformationsEnabled ? visualize.transformations : [],
    })),
    query => JSON.stringify([query.yAxis, query.transformations])
  );
}
