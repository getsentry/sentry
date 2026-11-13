import {parseFunction} from 'sentry/utils/discover/fields';

export function formatTimeSeriesTransformations(
  transformations: readonly string[] = []
): string {
  return transformations
    .map(transformation => {
      const parsed = parseFunction(transformation);
      if (parsed?.name !== 'smooth') {
        return transformation;
      }

      const [method, ...parameters] = parsed.arguments;
      if (method !== 'sma' && method !== 'ema' && method !== 'asap') {
        return transformation;
      }

      const label = method.toUpperCase();
      return parameters.length ? `${label}(${parameters.join(',')})` : label;
    })
    .join(' → ');
}
