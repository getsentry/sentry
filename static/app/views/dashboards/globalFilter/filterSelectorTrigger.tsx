import {Badge} from '@sentry/scraps/badge';
import type {SelectOption} from '@sentry/scraps/compactSelect';
import {Container, Flex} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {OP_LABELS} from 'sentry/components/searchQueryBuilder/tokens/filter/utils';
import {TermOperator} from 'sentry/components/searchSyntax/parser';
import {t} from 'sentry/locale';
import {prettifyTagKey} from 'sentry/utils/fields';
import {getDatasetLabel} from 'sentry/views/dashboards/globalFilter/addFilter';
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {FILTER_SELECTOR_TRIGGER_MAX_WIDTH} from './settings';

type FilterSelectorTriggerButtonProps = React.ComponentProps<
  typeof OverlayTrigger.Button
> & {
  globalFilter: GlobalFilter;
  showDatasetLabel?: boolean;
};

/**
 * Trigger button shared by all global filter selectors. Always shows the
 * filter's dataset in a tooltip, and optionally inline as a muted prefix (used
 * to disambiguate filters on the same key across different datasets).
 */
export function FilterSelectorTriggerButton({
  globalFilter,
  showDatasetLabel,
  children,
  ...triggerProps
}: FilterSelectorTriggerButtonProps) {
  const datasetLabel = getDatasetLabel(globalFilter.dataset);

  return (
    <Tooltip
      title={t('%s Filter', datasetLabel)}
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
