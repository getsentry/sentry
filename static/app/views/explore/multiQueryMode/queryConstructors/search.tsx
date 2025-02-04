import {EAPSpanSearchQueryBuilder} from 'sentry/components/performance/spanSearchQueryBuilder';
import {t} from 'sentry/locale';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

export function SearchBarSection() {
  const {selection} = usePageFilters();
  const numberTags = useSpanTags('number');
  const stringTags = useSpanTags('string');

  return (
    <Section data-test-id="section-filter">
      <SectionHeader>
        <SectionLabel underlined={false}>{t('Filter')}</SectionLabel>
      </SectionHeader>
      <EAPSpanSearchQueryBuilder
        projects={selection.projects}
        initialQuery={''}
        onSearch={() => {}}
        searchSource="explore"
        numberTags={numberTags}
        stringTags={stringTags}
      />
    </Section>
  );
}
