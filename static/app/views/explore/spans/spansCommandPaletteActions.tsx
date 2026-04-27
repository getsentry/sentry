import {useMemo} from 'react';
import orderBy from 'lodash/orderBy';

import {
  cmdkQueryOptions,
  type CMDKQueryOptions,
} from 'sentry/components/commandPalette/types';
import {
  CMDKAction,
  type CMDKResourceContext,
} from 'sentry/components/commandPalette/ui/cmdk';
import {CommandPaletteSlot} from 'sentry/components/commandPalette/ui/commandPaletteSlot';
import {normalizeDateTimeParams} from 'sentry/components/pageFilters/parse';
import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {IconFilter, IconSpan} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {Tag} from 'sentry/types/group';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {EXPLORE_FIVE_MIN_STALE_TIME} from 'sentry/views/explore/constants';
import {useSpanItemAttributes} from 'sentry/views/explore/contexts/traceItemAttributeContext';
import {
  useAddSearchFilter,
  useQueryParamsQuery,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';

interface SpanAttributeValue {
  value: string;
}

function capitalizeLabel(label: string): string {
  return `${label.charAt(0).toUpperCase()}${label.slice(1)}`;
}

function FilterActions() {
  const api = useApi();
  const organization = useOrganization();
  const {selection: pageFilters} = usePageFilters();
  const addSearchFilter = useAddSearchFilter();
  const currentQuery = useQueryParamsQuery();

  const {attributes: stringAttributes} = useSpanItemAttributes({}, 'string');
  const {attributes: booleanAttributes} = useSpanItemAttributes({}, 'boolean');

  const pageFilterCacheKey = useMemo(
    () =>
      [
        pageFilters.projects.join(','),
        pageFilters.datetime.period ?? '',
        pageFilters.datetime.start?.toString() ?? '',
        pageFilters.datetime.end?.toString() ?? '',
      ].join('|'),
    [pageFilters]
  );

  const sortedStringAttributes = useMemo(
    () => orderBy(Object.values(stringAttributes), ['key']),
    [stringAttributes]
  );

  const sortedBooleanAttributes = useMemo(
    () => orderBy(Object.values(booleanAttributes), ['key']),
    [booleanAttributes]
  );

  const makeStringFilterItem = (tag: Tag) => ({
    display: {label: capitalizeLabel(tag.name ?? tag.key)},
    keywords: [tag.key],
    prompt: t('Select a value...'),
    resource: (_q: string, ctx: CMDKResourceContext): CMDKQueryOptions =>
      // Include currentQuery in the key so onAction closures reference the
      // current filter state and don't overwrite previously applied filters.
      // eslint-disable-next-line @tanstack/query/exhaustive-deps
      cmdkQueryOptions({
        queryKey: [
          'cmdk-span-filter-values',
          tag.key,
          pageFilterCacheKey,
          organization.slug,
          currentQuery,
        ],
        queryFn: async () => {
          const result: SpanAttributeValue[] = await api.requestPromise(
            `/organizations/${organization.slug}/trace-items/attributes/${tag.key}/values/`,
            {
              method: 'GET',
              query: {
                itemType: TraceItemDataset.SPANS,
                attributeType: 'string',
                ...(pageFilters.projects.length
                  ? {project: pageFilters.projects.map(String)}
                  : {}),
                ...normalizeDateTimeParams(pageFilters.datetime),
              },
            }
          );
          return result
            .filter(item => item.value)
            .map(item => ({
              display: {label: item.value},
              onAction: () => addSearchFilter({key: tag.key, value: item.value}),
            }));
        },
        enabled: ctx.state === 'selected',
        staleTime: EXPLORE_FIVE_MIN_STALE_TIME,
      }),
  });

  const makeStringSectionResource =
    (tags: Tag[], cacheKey: string) =>
    (_q: string, ctx: CMDKResourceContext): CMDKQueryOptions =>
      // Include tags.length so the section updates when attributes finish loading.
      // Include currentQuery so the item closures capture fresh filter state.
      // eslint-disable-next-line @tanstack/query/exhaustive-deps
      cmdkQueryOptions({
        queryKey: [
          cacheKey,
          organization.slug,
          pageFilterCacheKey,
          currentQuery,
          tags.length,
        ],
        queryFn: () => tags.map(makeStringFilterItem),
        enabled: ctx.state === 'selected',
        staleTime: Infinity,
      });

  return (
    <CMDKAction
      display={{label: t('Filter by'), icon: <IconFilter />}}
      keywords={['search', 'filter', 'narrow', 'where', 'show']}
    >
      {sortedStringAttributes.length > 0 && (
        <CMDKAction
          display={{label: t('Span Attributes')}}
          prompt={t('Select a filter...')}
          limit={4}
          resource={makeStringSectionResource(
            sortedStringAttributes,
            'cmdk-span-filter-keys-string'
          )}
        />
      )}
      {sortedBooleanAttributes.map(tag => (
        <CMDKAction
          key={tag.key}
          display={{label: capitalizeLabel(tag.name ?? tag.key)}}
          keywords={[tag.key]}
        >
          <CMDKAction
            display={{label: t('true')}}
            onAction={() => addSearchFilter({key: tag.key, value: 'true'})}
          />
          <CMDKAction
            display={{label: t('false')}}
            onAction={() => addSearchFilter({key: tag.key, value: 'false'})}
          />
        </CMDKAction>
      ))}
    </CMDKAction>
  );
}

export function SpansCommandPaletteActions() {
  return (
    <CommandPaletteSlot name="page">
      <CMDKAction display={{label: t('Traces'), icon: <IconSpan />}}>
        <FilterActions />
      </CMDKAction>
    </CommandPaletteSlot>
  );
}
