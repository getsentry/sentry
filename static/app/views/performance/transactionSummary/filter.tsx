import styled from '@emotion/styled';
import {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import CompactSelect from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {SpanOpBreakdown} from 'sentry/utils/fields';
import {decodeScalar} from 'sentry/utils/queryString';

import {decodeHistogramZoom} from './transactionOverview/latencyChart/utils';

// Make sure to update other instances like trends column fields, discover field types.
export enum SpanOperationBreakdownFilter {
  None = 'none',
  Http = 'http',
  Db = 'db',
  Browser = 'browser',
  Resource = 'resource',
  Ui = 'ui',
}

export const SPAN_OPERATION_BREAKDOWN_FILTER_TO_FIELD: Partial<
  Record<SpanOperationBreakdownFilter, string>
> = {
  [SpanOperationBreakdownFilter.Http]: SpanOpBreakdown.SpansHttp,
  [SpanOperationBreakdownFilter.Db]: SpanOpBreakdown.SpansDb,
  [SpanOperationBreakdownFilter.Browser]: SpanOpBreakdown.SpansBrowser,
  [SpanOperationBreakdownFilter.Resource]: SpanOpBreakdown.SpansResource,
  [SpanOperationBreakdownFilter.Ui]: SpanOpBreakdown.SpansUi,
};

const OPTIONS: SpanOperationBreakdownFilter[] = [
  SpanOperationBreakdownFilter.Http,
  SpanOperationBreakdownFilter.Db,
  SpanOperationBreakdownFilter.Browser,
  SpanOperationBreakdownFilter.Resource,
  SpanOperationBreakdownFilter.Ui,
];

export const spanOperationBreakdownSingleColumns = OPTIONS.map(o => `spans.${o}`);

type Props = {
  currentFilter: SpanOperationBreakdownFilter;
  onChangeFilter: (newFilter: SpanOperationBreakdownFilter) => void;
  organization: OrganizationSummary;
};

function Filter(props: Props) {
  const {currentFilter, onChangeFilter} = props;

  const menuOptions = OPTIONS.map(operationName => ({
    value: operationName,
    label: operationName,
    leadingItems: <OperationDot backgroundColor={pickBarColor(operationName)} />,
  }));

  return (
    <GuideAnchor target="span_op_breakdowns_filter" position="top">
      <CompactSelect
        isClearable
        menuTitle={t('Filter by operation')}
        options={menuOptions}
        value={currentFilter}
        onChange={opt => onChangeFilter(opt?.value)}
        triggerProps={{
          icon: <IconFilter />,
          'data-test-id': 'span-operation-breakdown-filter',
        }}
        triggerLabel={
          currentFilter === SpanOperationBreakdownFilter.None
            ? t('Filter')
            : currentFilter
        }
      />
    </GuideAnchor>
  );
}

const OperationDot = styled('div')<{backgroundColor: string}>`
  display: block;
  width: ${space(1)};
  height: ${space(1)};
  border-radius: 100%;
  background-color: ${p => p.backgroundColor};
`;

export function filterToField(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
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
    case SpanOperationBreakdownFilter.None:
      return query ? query.trim() : undefined;
    default: {
      return `${query} has:${filterToField(option)}`.trim();
    }
  }
}

export function filterToColor(option: SpanOperationBreakdownFilter) {
  switch (option) {
    case SpanOperationBreakdownFilter.None:
      return pickBarColor('');
    default: {
      return pickBarColor(option);
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

  return SpanOperationBreakdownFilter.None;
}

export function decodeFilterFromLocation(location: Location) {
  return stringToFilter(
    decodeScalar(location.query.breakdown, SpanOperationBreakdownFilter.None)
  );
}

export function filterToLocationQuery(option: SpanOperationBreakdownFilter) {
  return {
    breakdown: option as string,
  };
}

export default Filter;
