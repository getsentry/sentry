import type {QueryTransformations} from 'sentry/views/dashboards/utils/transformations';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';

import {getServerTransformations} from './outliersTransformation';

export function visualizesToWidgetTransformations(
  visualizes: readonly Visualize[]
): QueryTransformations | undefined {
  const transformations: QueryTransformations = {};
  visualizes.forEach((visualize, index) => {
    // Dashboards don't support transformations applied in the browser
    const serverTransformations = getServerTransformations(visualize.transformations);
    if (serverTransformations.length > 0) {
      transformations[index] = [...serverTransformations];
    }
  });
  return Object.keys(transformations).length > 0 ? transformations : undefined;
}
