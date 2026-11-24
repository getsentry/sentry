import type {QueryTransformations} from 'sentry/views/dashboards/utils/transformations';
import type {Visualize} from 'sentry/views/explore/queryParams/visualize';

export function visualizesToWidgetTransformations(
  visualizes: readonly Visualize[]
): QueryTransformations | undefined {
  const transformations: QueryTransformations = {};
  visualizes.forEach((visualize, index) => {
    if (visualize.transformations.length > 0) {
      transformations[index] = [...visualize.transformations];
    }
  });
  return Object.keys(transformations).length > 0 ? transformations : undefined;
}
