import {type ReactNode} from 'react';

import {parseFunction} from 'sentry/utils/discover/fields';

export function formatTraceMetricsFunction(
  valueToParse: string | string[],
  defaultValue?: string | ReactNode
) {
  if (Array.isArray(valueToParse)) {
    const parsedFunctions = valueToParse.map(v => parseFunction(v));
    const functionNames = parsedFunctions.map(f => f?.name).join(', ');
    const firstFunction = parsedFunctions[0];
    return `${functionNames}(${firstFunction?.arguments[1] ?? '…'})`;
  }

  const parsedFunction = parseFunction(valueToParse);
  if (parsedFunction) {
    return `${parsedFunction.name}(${parsedFunction.arguments[1] ?? '…'})`;
  }
  return defaultValue ?? valueToParse;
}
