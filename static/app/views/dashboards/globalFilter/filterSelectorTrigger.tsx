import {Badge} from '@sentry/scraps/badge';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {getDatasetLabel} from './datasetLabels';
import {FILTER_SELECTOR_TRIGGER_MAX_WIDTH} from './settings';

type FilterSelectorTriggerButtonProps = React.ComponentProps<
  typeof OverlayTrigger.Button
> & {
  globalFilter: GlobalFilter;
  /**
   * Untruncated text of the filter, shown in the tooltip because the trigger
   * truncates long keys and values.
   */
  filterSummary?: string;
  showDatasetLabel?: boolean;
};

/**
 * Trigger button shared by all global filter selectors. Always shows the
 * filter's dataset in a tooltip, and optionally inline as a muted prefix (used
 * to disambiguate filters on the same key across different datasets).
 */
export function FilterSelectorTriggerButton({
  globalFilter,
  filterSummary,
  showDatasetLabel,
  children,
  ...triggerProps
}: FilterSelectorTriggerButtonProps) {
  const datasetLabel = getDatasetLabel(globalFilter.dataset);

  return (
    <Tooltip
      title={
        filterSummary ? (
          <Stack gap="xs">
            <Text bold>{t('%s Filter', datasetLabel)}</Text>
            <Text wordBreak="break-all">{filterSummary}</Text>
          </Stack>
        ) : (
          t('%s Filter', datasetLabel)
        )
      }
      // The open menu already shows the dataset in its title
      disabled={!!triggerProps['aria-expanded']}
      skipWrapper
    >
      <OverlayTrigger.Button {...triggerProps}>
        <Flex gap="xs" align="center" minWidth={0}>
          {showDatasetLabel && (
            <Text variant="muted" bold={false}>
              {datasetLabel}
            </Text>
          )}
          {children}
        </Flex>
      </OverlayTrigger.Button>
    </Tooltip>
  );
}

type FilterSelectorTriggerProps = {
  activeFilterValues: string[];
  globalFilter: GlobalFilter;
  operator: TermOperator;
  options: Array<SelectOption<string>>;
};

function getOperatorLabel(operator: TermOperator) {
  return operator === TermOperator.DEFAULT ? ':' : OP_LABELS[operator];
}

export function getFilterSummary({
  globalFilter,
  activeFilterValues,
  operator,
  options,
}: FilterSelectorTriggerProps) {
  const values = activeFilterValues.length
    ? activeFilterValues
        .map(value => {
          const label = options.find(option => option.value === value)?.label;
          return typeof label === 'string' && label ? label : value;
        })
        .join(', ')
    : t('All');

  const separator =
    operator === TermOperator.DEFAULT ? ':' : ` ${getOperatorLabel(operator)}`;
  return `${prettifyTagKey(globalFilter.tag.key)}${separator} ${values}`;
}

export function FilterSelectorTrigger({
  globalFilter,
  activeFilterValues,
  operator,
  options,
}: FilterSelectorTriggerProps) {
  const {tag} = globalFilter;

  const shouldShowBadge = activeFilterValues.length > 1;

  // "All" means no filter is applied (empty selection). We intentionally avoid
  // comparing against options.length because when tag values fail to load,
  // options only contains the already-selected values — making a length
  // comparison a tautology that incorrectly shows "All".
  const isAllSelected = activeFilterValues.length === 0;

  const tagKey = prettifyTagKey(tag.key);
  const filterValue = activeFilterValues[0] ?? '';
  const opLabel = getOperatorLabel(operator);
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

      {isAllSelected ? (
        <Text variant="primary" bold={false}>
          {t('All')}
        </Text>
      ) : (
        <Container minWidth={0} flexShrink={1} flexGrow={0} overflow="hidden">
          <Text variant="primary" bold={false} ellipsis>
            {label}
          </Text>
        </Container>
      )}

      {shouldShowBadge && (
        <Container>
          <Badge variant="muted">{`+${activeFilterValues.length - 1}`}</Badge>
        </Container>
      )}
    </Flex>
  );
}
