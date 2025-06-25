import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {
  type ReadableExploreQueryParts,
  useUpdateQueryAtIndex,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';

type Props = {index: number; query: ReadableExploreQueryParts};

export function GroupBySection({query, index}: Props) {
  const {tags} = useTraceItemTags();

  const updateGroupBys = useUpdateQueryAtIndex(index);

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
    groupBys: [],
    tags,
    hideEmptyOption: true,
  });

  return (
    <Section data-test-id={`section-group-by-${index}`}>
      <SectionHeader>
        <Tooltip
          title={t(
            'Aggregate data by a key attribute to calculate averages, percentiles, count and more.'
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
