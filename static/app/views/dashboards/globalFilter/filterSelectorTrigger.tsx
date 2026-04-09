import styled from '@emotion/styled';

import {Badge} from '@sentry/scraps/badge';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import type {UseQueryResult} from 'sentry/utils/queryClient';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {FILTER_SELECTOR_TRIGGER_MAX_WIDTH} from './settings';

type FilterSelectorTriggerProps = {
  activeFilterValues: string[];
  globalFilter: GlobalFilter;
  operator: TermOperator;
  options: Array<SelectOption<string>>;
  queryResult: UseQueryResult<string[], Error>;
};

export function FilterSelectorTrigger({
  globalFilter,
  activeFilterValues,
  operator,
  options,
  queryResult,
}: FilterSelectorTriggerProps) {
  const {isFetching} = queryResult;
  const {tag} = globalFilter;

  const shouldShowBadge = !isFetching && activeFilterValues.length > 1;

  // "All" means no filter is applied (empty selection). We intentionally avoid
  // comparing against options.length because when tag values fail to load,
  // options only contains the already-selected values — making a length
  // comparison a tautology that incorrectly shows "All".
  const isAllSelected = activeFilterValues.length === 0;

  const tagKey = prettifyTagKey(tag.key);
  const filterValue = activeFilterValues[0] ?? '';
  const isDefaultOperator = operator === TermOperator.DEFAULT;
  const opLabel = isDefaultOperator ? ':' : OP_LABELS[operator];
  const label =
    options.find(option => option.value === filterValue)?.label || filterValue;

  return (
    <Flex
      gap="xs"
      align="center"
      minWidth={0}
      maxWidth={FILTER_SELECTOR_TRIGGER_MAX_WIDTH}
    >
      <Container minWidth={0} flexShrink={1} flexGrow={0} overflow="hidden">
        <Text variant="primary" ellipsis>
          {tagKey}
        </Text>
      </Container>

      <Text variant="muted" bold={false}>
        {opLabel}
      </Text>

      {!isFetching &&
        (isAllSelected ? (
          <Text variant="primary" bold={false}>
            {t('All')}
          </Text>
        ) : (
          <Container minWidth={0} flexShrink={1} flexGrow={0} overflow="hidden">
            <Text variant="primary" bold={false} ellipsis>
              {label}
            </Text>
          </Container>
        ))}

      {isFetching && <InlineLoadingIndicator size={14} />}

      {shouldShowBadge && (
        <Container>
          <Badge variant="muted">{`+${activeFilterValues.length - 1}`}</Badge>
        </Container>
      )}
    </Flex>
  );
}

const InlineLoadingIndicator = styled(LoadingIndicator)`
  && {
    margin: 0;
    margin-left: ${p => p.theme.space.xs};
  }
`;
