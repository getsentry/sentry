import styled from '@emotion/styled';

import {CompactSelect, type SelectOption} from '@sentry/scraps/compactSelect';
import {Tooltip} from '@sentry/scraps/tooltip';

import {t} from 'sentry/locale';
import {useTraceItemTags} from 'sentry/views/explore/contexts/spanTagsContext';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {
  useUpdateQueryAtIndex,
  type ReadableExploreQueryParts,
} from 'sentry/views/explore/multiQueryMode/locationUtils';
import {
  Section,
  SectionHeader,
  SectionLabel,
} from 'sentry/views/explore/multiQueryMode/queryConstructors/styles';
import {TraceItemDataset} from 'sentry/views/explore/types';

type Props = {index: number; query: ReadableExploreQueryParts};

export function GroupBySection({query, index}: Props) {
  const {tags: numberTags} = useTraceItemTags('number');
  const {tags: stringTags} = useTraceItemTags('string');

  const updateGroupBys = useUpdateQueryAtIndex(index);

  const enabledOptions: Array<SelectOption<string>> = useGroupByFields({
    groupBys: [],
    numberTags,
    stringTags,
    traceItemType: TraceItemDataset.SPANS,
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
