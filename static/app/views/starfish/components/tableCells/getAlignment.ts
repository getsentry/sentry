import {
  aggregateFunctionOutputType,
  AggregationOutputType,
  Alignments,
  parseFunction,
} from 'sentry/utils/discover/fields';

const rightAlignedColumns: AggregationOutputType[] = ['duration', 'integer', 'number'];

export const getAlignment = (key: string) => {
  let alignment: Alignments = 'left';
  const result = parseFunction(key);
  if (result) {
    const outputType = aggregateFunctionOutputType(result.name, result.arguments[0]);
    if (outputType && rightAlignedColumns.includes(outputType)) {
      alignment = 'right';
    }
  }
  return alignment;
};
