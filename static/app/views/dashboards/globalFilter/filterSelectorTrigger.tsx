import {Fragment} from 'react';

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
import type {GlobalFilter} from 'sentry/views/dashboards/types';

import {getDatasetLabel} from './datasetLabels';
import {
  FILTER_SELECTOR_TOOLTIP_MAX_WIDTH,
  FILTER_SELECTOR_TRIGGER_MAX_WIDTH,
} from './settings';

type FilterSelectorTriggerButtonProps = React.ComponentProps<
  typeof OverlayTrigger.Button
> & {
  /**
   * The full, untruncated filter (e.g. `span.op is db, http`), shown in the
   * tooltip because the trigger ellipsizes long keys and values.
   */
  description: string;
  globalFilter: GlobalFilter;
  showDatasetLabel?: boolean;
};

/**
 * Trigger button shared by all global filter selectors. Always shows the
 * filter's dataset and full description in a tooltip, and optionally the
 * dataset inline as a muted prefix (used to disambiguate filters on the same
 * key across different datasets).
 */
export function FilterSelectorTriggerButton({
  globalFilter,
  description,
  showDatasetLabel,
  children,
  ...triggerProps
}: FilterSelectorTriggerButtonProps) {
  const datasetLabel = getDatasetLabel(globalFilter.dataset);

  return (
    <Tooltip
      title={
        <Fragment>
          <Tooltip.Header>{t('%s Filter', datasetLabel)}</Tooltip.Header>
          <Tooltip.Grid>
            <Text>{description}</Text>
          </Tooltip.Grid>
        </Fragment>
      }
      maxWidth={FILTER_SELECTOR_TOOLTIP_MAX_WIDTH}
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

/**
 * Plain-text version of `FilterSelectorTrigger` with nothing truncated.
 */
export function getFilterSelectorDescription({
  globalFilter,
  activeFilterValues,
  operator,
  options,
}: FilterSelectorTriggerProps): string {
  const tagKey = prettifyTagKey(globalFilter.tag.key);

  if (activeFilterValues.length === 0) {
    return `${tagKey}: ${t('All')}`;
  }

  // Prefer `textValue`: long values get a middle-ellipsized `label`
  const values = activeFilterValues.map(value => {
    const option = options.find(opt => opt.value === value);
    if (option?.textValue) {
      return option.textValue;
    }
    return typeof option?.label === 'string' && option.label ? option.label : value;
  });

  return `${tagKey} ${OP_LABELS[operator]} ${values.join(', ')}`;
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
