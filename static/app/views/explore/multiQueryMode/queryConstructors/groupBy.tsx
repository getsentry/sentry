import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
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

export function GroupBySection({query, index}: Props) {
  const tags = useSpanTags();

  const updateGroupBys = useUpdateQueryAtIndex(index);

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
    <Section data-test-id={`section-group-by-${index}`}>
      <SectionHeader>
        <SectionLabel underlined={false}>{t('Group By')}</SectionLabel>
      </SectionHeader>
      <StyledCompactSelect
        multiple
        options={enabledOptions}
        value={query.groupBys}
        clearable
        searchable
        onChange={options =>
          updateGroupBys({groupBys: options.map(value => value.value.toString())})
        }
      />
    </Section>
  );
}

const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;
  > button {
    width: 100%;
  }
`;
