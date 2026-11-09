import {parseAsJson} from 'nuqs';
import {z} from 'zod';

import {DisplayType, WidgetType, type WidgetQuery} from 'sentry/views/dashboards/types';

export type QueryTransformations = NonNullable<WidgetQuery['transformations']>;

export function supportsWidgetTransformations(
  dataset: WidgetType | undefined,
  displayType: DisplayType | undefined
): boolean {
  return (
    (dataset === WidgetType.SPANS ||
      dataset === WidgetType.LOGS ||
      dataset === WidgetType.TRACEMETRICS) &&
    (displayType === DisplayType.LINE ||
      displayType === DisplayType.AREA ||
      displayType === DisplayType.BAR)
  );
}

/**
 * Builds the transformations for a new list of series. `sourceIndices[i]` is the
 * position series `i` had before the change, or `undefined` when it has no
 * earlier transformations to keep.
 */
export function remapTransformations(
  transformations: QueryTransformations,
  sourceIndices: ReadonlyArray<number | undefined>
): QueryTransformations {
  return Object.fromEntries(
    sourceIndices.flatMap((sourceIndex, index) => {
      if (sourceIndex === undefined) {
        return [];
      }
      const axisTransformations = transformations[sourceIndex];
      return axisTransformations?.length ? [[index, axisTransformations]] : [];
    })
  );
}

export const parseAsTransformations = parseAsJson(
  z.array(z.record(z.number().int().nonnegative(), z.array(z.string())))
);
