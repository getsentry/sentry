import type {Theme} from '@emotion/react';
import {useTheme} from '@emotion/react';
import type {Location} from 'history';

import {Container} from '@sentry/scraps/layout';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {SpanOpBreakdown} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';

import {decodeHistogramZoom} from './transactionOverview/latencyChart/utils';

// Make sure to update other instances like trends column fields, discover field types.
export enum SpanOperationBreakdownFilter {
  NONE = 'none',
  HTTP = 'http',
  DB = 'db',
  BROWSER = 'browser',
  RESOURCE = 'resource',
  UI = 'ui',
}

export const SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD: Partial<
  Record<SpanOperationBreakdownFilter, string>
> = {
  [SpanOperationBreakdownFilter.HTTP]: SpanOpBreakdown.SPANS_HTTP,
  [SpanOperationBreakdownFilter.DB]: SpanOpBreakdown.SPANS_DB,
  [SpanOperationBreakdownFilter.BROWSER]: SpanOpBreakdown.SPANS_BROWSER,
  [SpanOperationBreakdownFilter.RESOURCE]: SpanOpBreakdown.SPANS_RESOURCE,
  [SpanOperationBreakdownFilter.UI]: SpanOpBreakdown.SPANS_UI,
};

const OPTIONS: SpanOperationBreakdownFilter[] = [
  SpanOperationBreakdownFilter.HTTP,
  SpanOperationBreakdownFilter.DB,
  SpanOperationBreakdownFilter.BROWSER,
  SpanOperationBreakdownFilter.RESOURCE,
  SpanOperationBreakdownFilter.UI,
];

type Props = {
  currentFilter: SpanOperationBreakdownFilter;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter | undefined) => void;
  organization: OrganizationSummary;
};

function Filter(props: Props) {
  const theme = useTheme();
  const {currentFilter, onChangeFilter} = props;
  const menuOptions = OPTIONS.map(operationName => ({
    value: operationName,
    label: operationName,
    leadingItems: <OperationDot backgroundColor={pickBarColor(operationName, theme)} />,
  }));

  return (
    <GuideAnchor target="span_op_breakdowns_filter" position="top">
      <CompactSelect
        clearable
        menuTitle={t('Filter by operation')}
        options={menuOptions}
        value={currentFilter}
        onChange={opt => onChangeFilter(opt?.value)}
        triggerProps={{
          icon: <IconFilter />,
          'aria-label': t('Filter by operation'),
          children:
            currentFilter === SpanOperationBreakdownFilter.NONE
              ? t('Filter')
              : currentFilter,
        }}
      />
    </GuideAnchor>
  );
}

function OperationDot({backgroundColor}: {backgroundColor: string}) {
  const theme = useTheme();
  return (
    <Container
      width={theme.space.md}
      height={theme.space.md}
      alignSelf="center"
      style={{
        borderRadius: theme.radius.full,
        backgroundColor,
      }}
    />
  );
}

export function filterToField(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.NONE:
      return undefined;
    default: {
      return `spans.${option}`;
    }
  }
}

export function filterToSearchConditions(
  option: SpanOperationBreakdownFilter,
  location: Location
) {
  let field = filterToField(option);
  if (!field) {
    field = 'transaction.duration';
  }

  // Add duration search conditions implicitly

  const {min, max} = decodeHistogramZoom(location);
  let query = '';
  if (typeof min === 'number') {
    query = `${query} ${field}:>${min}ms`;
  }
  if (typeof max === 'number') {
    query = `${query} ${field}:<${max}ms`;
  }
  switch (option) {
    case SpanOperationBreakdownFilter.NONE:
      return query ? query.trim() : undefined;
    default: {
      return `${query} has:${filterToField(option)}`.trim();
    }
  }
}

export function filterToColor(option: SpanOperationBreakdownFilter, theme: Theme) {
  switch (option) {
    case SpanOperationBreakdownFilter.NONE:
      return pickBarColor('', theme);
    default: {
      return pickBarColor(option, theme);
    }
  }
}

export function stringToFilter(option: string) {
  if (
    Object.values(SpanOperationBreakdownFilter).includes(
      option as SpanOperationBreakdownFilter
    )
  ) {
    return option as SpanOperationBreakdownFilter;
  }

  return SpanOperationBreakdownFilter.NONE;
}

export function decodeFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.breakdown, SpanOperationBreakdownFilter.NONE)
  );
}

export function filterToLocationQuery(option: SpanOperationBreakdownFilter | undefined) {
  return {
    breakdown: option,
  };
}

export default Filter;
