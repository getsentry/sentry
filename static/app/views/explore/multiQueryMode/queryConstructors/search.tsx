import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {
  index: number;
  query: ReadableExploreQueryParts;
};

export function SearchBarSection({query, index}: Props) {
  const {selection} = usePageFilters();
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  const updateQuerySearch = useUpdateQueryAtIndex(index);

  return (
    <Section data-test-id={`section-filter-${index}`}>
      <SectionHeader>
        <Tooltip title={t('Key attributes you would like to narrow results down to')}>
          <SectionLabel>{t('Filter')}</SectionLabel>
        </Tooltip>
      </SectionHeader>
      <EAPSpanSearchQueryBuilder
        projects={selection.projects}
        initialQuery={query.query ?? ''}
        onSearch={value => updateQuerySearch({query: value})}
        searchSource="explore"
        numberTags={numberTags}
        stringTags={stringTags}
      />
    </Section>
  );
}
