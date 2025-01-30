import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import {useSpanTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

export function GroupBySection() {
  const tags = useSpanTags();

  const enabledOptions: Array<SelectOption<string>> = useMemo(() => {
    const potentialOptions = Object.keys(tags).filter(key => key !== 'id');
    potentialOptions.sort();

    return potentialOptions.map(key => ({
      label: key,
      value: key,
      textValue: key,
    }));
  }, [tags]);

  return (
    <Section data-test-id="section-group-by">
      <SectionHeader>
        <SectionLabel underlined={false}>{t('Group By')}</SectionLabel>
      </SectionHeader>
      <StyledCompactSelect multiple options={enabledOptions} clearable searchable />
    </Section>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;
  > button {
    width: 100%;
  }
`;
