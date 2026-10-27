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
 * Builds the pipelines for a new list of series. `sourceIndices[i]` is the
 * position series `i` had before the change, or `undefined` when it has no
 * earlier pipeline to keep.
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
      const pipeline = transformations[sourceIndex];
      return pipeline?.length ? [[index, pipeline]] : [];
    })
  );
}

const transformationsSchema = z.array(
  z.record(z.number().int().nonnegative(), z.array(z.string()))
);

export function deserializeTransformations(value: string): QueryTransformations[] | null {
  try {
    const result = transformationsSchema.safeParse(JSON.parse(value));
    return result.success ? result.data : null;
  } catch {
    return null;
  }
}
