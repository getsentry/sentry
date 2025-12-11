import {Tooltip} from 'sentry/components/core/tooltip';
import {useEAPSpanSearchQueryBuilderProps} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import {TraceItemSearchQueryBuilder} from 'sentry/views/explore/components/traceItemSearchQueryBuilder';
import {
  useUpdateQueryAtIndex,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {index: number; query: ReadableExploreQueryParts};

export function SearchBarSection({query, index}: Props) {
  const {selection} = usePageFilters();

  const updateQuerySearch = useUpdateQueryAtIndex(index);

  const {eapSpanSearchQueryBuilderProps} = useEAPSpanSearchQueryBuilderProps({
    projects: selection.projects,
    initialQuery: query.query ?? '',
    onSearch: value => updateQuerySearch({query: value}),
    searchSource: 'explore',
  });

  return (
    <Section data-test-id={`section-filter-${index}`}>
      <SectionHeader>
        <Tooltip title={t('Key attributes you would like to narrow results down to')}>
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>
      </SectionHeader>
      <TraceItemSearchQueryBuilder {...eapSpanSearchQueryBuilderProps} />
    </Section>
  );
}
