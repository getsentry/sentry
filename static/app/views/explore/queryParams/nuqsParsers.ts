import type {Location} from 'history';
import {
  createMultiParser,
  createParser,
  createSerializer,
  type inferParserType,
  type ParserMap,
} from 'nuqs';
import * as qs from 'query-string';

import {decodeSorts} from 'sentry/utils/queryString';
import {
  parseAggregateField,
  type AggregateField,
} from 'sentry/views/explore/queryParams/aggregateField';
import {
  parseCrossEvents,
  type CrossEvent,
} from 'sentry/views/explore/queryParams/crossEvent';
import {Mode} from 'sentry/views/explore/queryParams/mode';
import {parseVisualize, type Visualize} from 'sentry/views/explore/queryParams/visualize';

export const parseAsMode = createParser({
  parse: value => {
    if (value === Mode.AGGREGATE || value === Mode.SAMPLES) {
      return value;
    }
    return null;
  },
  serialize: value => value,
});

export const parseAsExtrapolate = createParser({
  parse: value => {
    if (value === '0') {
      return false;
    }
    if (value === '1') {
      return true;
    }
    return null;
  },
  serialize: value => (value ? '1' : '0'),
});

export const parseAsFields = createMultiParser({
  parse: values => {
    const fields = values.filter(Boolean);
    return fields.length ? fields : null;
  },
  serialize: values => values.filter(Boolean),
});

export const parseAsSortBys = createMultiParser({
  parse: values => {
    const sortBys = decodeSorts([...values].filter(Boolean));
    return sortBys.length ? sortBys : null;
  },
  serialize: values =>
    values.map(sort => `${sort.kind === 'desc' ? '-' : ''}${sort.field}`),
});

export const parseAsGroupBys = createMultiParser({
  parse: values => {
    const groupBys = values.filter(Boolean).map(groupBy => ({groupBy}));
    return groupBys.length ? groupBys : null;
  },
  serialize: values => values.map(({groupBy}) => groupBy),
});

export const parseAsVisualizes = createMultiParser({
  parse: values => {
    const visualizes: Visualize[] = [];

    for (const rawVisualize of values) {
      let value: any;
      try {
        value = JSON.parse(rawVisualize);
      } catch {
        continue;
      }
      visualizes.push(...parseVisualize(value));
    }

    return visualizes.length ? visualizes : null;
  },
  serialize: values => values.map(visualize => JSON.stringify(visualize)),
});

export const parseAsAggregateFields = createMultiParser<AggregateField[]>({
  parse: values => {
    const aggregateFields: AggregateField[] = [];

    for (const rawAggregateField of values) {
      let value: any;
      try {
        value = JSON.parse(rawAggregateField);
      } catch {
        continue;
      }
      aggregateFields.push(...parseAggregateField(value));
    }

    return aggregateFields.length ? aggregateFields : null;
  },
  serialize: values => values.map(aggregateField => JSON.stringify(aggregateField)),
});

export const parseAsCrossEvents = createParser({
  parse: value => parseCrossEvents(value) ?? null,
  serialize: (value: readonly CrossEvent[]) => JSON.stringify(value),
});

export function serializeQueryParamsToLocation<Parsers extends ParserMap>(
  location: Location,
  parsers: Parsers,
  values: Partial<{
    [Key in keyof inferParserType<Parsers>]: inferParserType<Parsers>[Key] | null;
  }>
): Location {
  const serialize = createSerializer(parsers);
  const search = qs.stringify(location.query ?? {});
  const base = search ? `${location.pathname}?${search}` : (location.pathname ?? '');
  const target = serialize(base, values);
  const [pathname = location.pathname, queryString = ''] = target.split('?');

  const urlSearchParams = new URLSearchParams(queryString);
  const query: Record<string, string | string[]> = {};
  for (const key of new Set(urlSearchParams.keys())) {
    const allValues = urlSearchParams.getAll(key);
    const parser = parsers[key as keyof Parsers] as {type?: string} | undefined;
    if (allValues.length > 1 || parser?.type === 'multi') {
      query[key] = allValues;
    } else {
      query[key] = allValues[0]!;
    }
  }

  return {
    ...location,
    pathname,
    search: queryString ? `?${queryString}` : '',
    query,
  };
}
