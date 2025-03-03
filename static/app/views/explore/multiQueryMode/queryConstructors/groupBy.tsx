import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/compactSelect';
import {Tooltip} from 'sentry/components/tooltip';
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
    potentialOptions.sort((a, b) => {
      if (query.groupBys.includes(a) === query.groupBys.includes(b)) {
        return a.localeCompare(b);
      }
      if (query.groupBys.includes(a)) {
        return -1;
      }
      return 1;
    });

    return potentialOptions.map(key => ({
      label: key,
      value: key,
      textValue: key,
    }));
  }, [tags, query.groupBys]);

  return (
    <Section data-test-id={`section-group-by-${index}`}>
      <SectionHeader>
        <Tooltip
          title={t(
            'Aggregated data by a key attribute to calculate averages, percentiles, count and more.'
          )}
        >
          <SectionLabel>{t('Group By')}</SectionLabel>
        </Tooltip>
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
