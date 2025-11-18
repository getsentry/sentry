import styled from '@emotion/styled';

import {Badge} from 'sentry/components/core/badge';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TextOverflow from 'sentry/components/textOverflow';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {prettifyTagKey} from 'sentry/utils/fields';
import type {UseQueryResult} from 'sentry/utils/queryClient';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

type FilterSelectorTriggerProps = {
  activeFilterValues: string[];
  globalFilter: GlobalFilter;
  options: Array<SelectOption<string>>;
  queryResult: UseQueryResult<string[], Error>;
};

function FilterSelectorTrigger({
  globalFilter,
  activeFilterValues,
  options,
  queryResult,
}: FilterSelectorTriggerProps) {
  const {isFetching} = queryResult;
  const {tag} = globalFilter;

  const shouldShowBadge =
    !isFetching &&
    activeFilterValues.length > 1 &&
    activeFilterValues.length !== options.length;
  const isAllSelected =
    activeFilterValues.length === 0 || activeFilterValues.length === options.length;

  return (
    <ButtonLabelWrapper>
      <TextOverflow>
        {prettifyTagKey(tag.key)}:{' '}
        {!isFetching && (
          <span style={{fontWeight: 'normal'}}>
            {isAllSelected ? t('All') : activeFilterValues[0]}
          </span>
        )}
      </TextOverflow>
      {isFetching && <StyledLoadingIndicator size={14} />}
      {shouldShowBadge && (
        <StyledBadge type="default">{`+${activeFilterValues.length - 1}`}</StyledBadge>
      )}
    </ButtonLabelWrapper>
  );
}

export default FilterSelectorTrigger;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    margin-left: ${space(0.5)};
  }
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  height: 16px;
  line-height: 16px;
  min-width: 16px;
  border-radius: 16px;
  font-size: 10px;
  padding: 0 ${space(0.5)};
`;

const ButtonLabelWrapper = styled('span')`
  width: 100%;
  text-align: left;
  align-items: center;
  display: inline-grid;
  grid-template-columns: 1fr auto;
  line-height: 1;
`;
