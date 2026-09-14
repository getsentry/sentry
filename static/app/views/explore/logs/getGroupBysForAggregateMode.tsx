import {DISALLOWED_GROUP_BY_FIELDS} from 'sentry/views/explore/constants';
import {
  isVisualizeFunction,
  type Visualize,
} from 'sentry/views/explore/queryParams/visualize';
import {parseConditionalAggregate} from 'sentry/views/explore/utils/conditionalAggregate';

interface GetGroupBysForAggregateModeOptions {
  fields: readonly string[];
  groupBys: readonly string[];
  visualizes: readonly Visualize[];
}

export function getGroupBysForAggregateMode({
  fields,
  groupBys,
  visualizes,
}: GetGroupBysForAggregateModeOptions): string[] | null {
  if (!groupBys.some(Boolean)) {
    return null;
  }

  const alreadyUsed = new Set(groupBys);

  for (const visualize of visualizes) {
    if (isVisualizeFunction(visualize)) {
      const argument = parseConditionalAggregate(visualize.yAxis)?.arguments[0];
      if (argument) {
        alreadyUsed.add(argument);
      }
    }
  }

  const additionalGroupBys: string[] = [];

  for (const field of fields) {
    if (!field || alreadyUsed.has(field) || DISALLOWED_GROUP_BY_FIELDS.has(field)) {
      continue;
    }
    alreadyUsed.add(field);
    additionalGroupBys.push(field);
  }

  if (!additionalGroupBys.length) {
    return null;
  }

  return [...groupBys.filter(Boolean), ...additionalGroupBys];
}
