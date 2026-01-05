import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {Badge} from 'sentry/components/core/badge';
import type {SelectOption} from 'sentry/components/core/compactSelect/types';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import type {UseQueryResult} from 'sentry/utils/queryClient';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

type FilterSelectorTriggerProps = {
  activeFilterValues: string[];
  globalFilter: GlobalFilter;
  operator: TermOperator;
  options: Array<SelectOption<string>>;
  queryResult: UseQueryResult<string[], Error>;
};

function FilterSelectorTrigger({
  globalFilter,
  activeFilterValues,
  operator,
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

  const tagKey = prettifyTagKey(tag.key);
  const filterValue = activeFilterValues[0] ?? '';
  const isDefaultOperator = operator === TermOperator.DEFAULT;
  const opLabel = isDefaultOperator ? ':' : OP_LABELS[operator];
  const label =
    options.find(option => option.value === filterValue)?.label || filterValue;

  return (
    <ButtonLabelWrapper gap="xs">
      <Flex align="center" gap={isDefaultOperator ? '0' : 'xs'}>
        <FilterValueTruncated>{tagKey}</FilterValueTruncated>
        <SubText>{opLabel}</SubText>
      </Flex>
      {!isFetching && (
        <span style={{fontWeight: 'normal'}}>
          {isAllSelected ? (
            t('All')
          ) : (
            <FilterValueTruncated>{label}</FilterValueTruncated>
          )}
        </span>
      )}
      {isFetching && <StyledLoadingIndicator size={14} />}
      {shouldShowBadge && (
        <StyledBadge variant="muted">{`+${activeFilterValues.length - 1}`}</StyledBadge>
      )}
    </ButtonLabelWrapper>
  );
}

export default FilterSelectorTrigger;

const StyledLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    margin-left: ${p => p.theme.space.xs};
  }
`;

const StyledBadge = styled(Badge)`
  flex-shrink: 0;
  height: 16px;
  line-height: 16px;
  min-width: 16px;
  border-radius: 16px;
  font-size: 10px;
  padding: 0 ${p => p.theme.space.xs};
`;

const ButtonLabelWrapper = styled(Flex)`
  align-items: center;
`;

export const FilterValueTruncated = styled('div')`
  ${p => p.theme.overflowEllipsis};
  max-width: 300px;
  width: min-content;
`;

const SubText = styled('span')`
  color: ${p => p.theme.colors.gray500};
  font-weight: ${p => p.theme.fontWeight.normal};
`;
