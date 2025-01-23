import {useMemo} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {pickBarColor} from 'sentry/components/performance/waterfall/utils';
import {IconFilter} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

type NoFilter = {
  type: 'no_filter';
};

export type ActiveFilter = {
  operationNames: Set<string>;
  type: 'active_filter';
};

export const noFilter: NoFilter = {
  type: 'no_filter',
};

export type ActiveOperationFilter = NoFilter | ActiveFilter;

type Props = {
  operationNameCounts: Map<string, number>;
  operationNameFilter: ActiveOperationFilter;
  toggleOperationNameFilter: (operationName: string) => void;
};

function Filter({
  operationNameCounts,
  operationNameFilter,
  toggleOperationNameFilter,
}: Props) {
  const organization = useOrganization();

  const checkedQuantity =
    operationNameFilter.type === 'no_filter'
      ? 0
      : operationNameFilter.operationNames.size;
  const selectedOptions =
    operationNameFilter.type === 'no_filter'
      ? []
      : [...operationNameFilter.operationNames.keys()];

  // Memoize menuOptions to prevent CompactSelect from re-rendering every time
  // the value changes
  const menuOptions = useMemo(
    () =>
      [...operationNameCounts].map(([operationName, operationCount]) => ({
        value: operationName,
        label: operationName,
        leadingItems: <OperationDot backgroundColor={pickBarColor(operationName)} />,
        trailingItems: <OperationCount>{operationCount}</OperationCount>,
      })),
    [operationNameCounts]
  );

  function onChange(selectedOpts: any) {
    const mappedValues = selectedOpts.map((opt: any) => opt.value);

    // Send a single analytics event if user clicked on the "Clear" button
    if (selectedOpts.length === 0) {
      trackAnalytics('performance_views.event_details.filter_by_op', {
        organization,
        operation: 'ALL',
      });
    }

    // Go through all the available operations, and toggle them on/off if needed
    menuOptions.forEach(opt => {
      const opepationAlreadySelected =
        operationNameFilter.type !== 'no_filter' &&
        operationNameFilter.operationNames.has(opt.value);
      if (
        // Operation has just been added to the filter list --> toggle on
        (!opepationAlreadySelected && mappedValues.includes(opt.value)) ||
        // Operation has just been removed to the filter list --> toggle off
        (opepationAlreadySelected && !mappedValues.includes(opt.value))
      ) {
        toggleOperationNameFilter(opt.value);

        // Don't send individual analytics events if user clicked on the "Clear" button
        if (selectedOpts.length !== 0) {
          trackAnalytics('performance_views.event_details.filter_by_op', {
            organization,
            operation: opt.label,
          });
        }
      }
    });
  }

  if (operationNameCounts.size === 0) {
    return null;
  }

  return (
    <CompactSelect
      multiple
      clearable
      maxMenuWidth="24rem"
      options={menuOptions}
      onChange={onChange}
      value={selectedOptions}
      menuTitle={t('Filter by operation')}
      triggerLabel={
        checkedQuantity > 0
          ? tn('%s Active Filter', '%s Active Filters', checkedQuantity)
          : t('Filter')
      }
      triggerProps={{
        icon: <IconFilter />,
        priority: checkedQuantity > 0 ? 'primary' : 'default',
        'aria-label': t('Filter by operation'),
      }}
    />
  );
}

const OperationDot = styled('div')<{backgroundColor: string}>`
  display: block;
  width: ${space(1)};
  height: ${space(1)};
  border-radius: 100%;

  background-color: ${p => p.backgroundColor};
`;

const OperationCount = styled('span')`
  color: ${p => p.theme.subText};
  font-variant-numeric: tabular-nums;
`;

export function toggleFilter(
  previousState: ActiveOperationFilter,
  operationName: string
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set([operationName]),
    };
  }

  // invariant: previousState.type === 'active_filter'
  // invariant: previousState.operationNames.size >= 1

  const {operationNames} = previousState;

  if (operationNames.has(operationName)) {
    operationNames.delete(operationName);
  } else {
    operationNames.add(operationName);
  }

  if (operationNames.size > 0) {
    return {
      type: 'active_filter',
      operationNames,
    };
  }

  return {
    type: 'no_filter',
  };
}

export function toggleAllFilters(
  previousState: ActiveOperationFilter,
  operationNames: string[]
): ActiveOperationFilter {
  if (previousState.type === 'no_filter') {
    return {
      type: 'active_filter',
      operationNames: new Set(operationNames),
    };
  }

  // invariant: previousState.type === 'active_filter'

  if (previousState.operationNames.size === operationNames.length) {
    // all filters were selected, so the next state should un-select all filters
    return {
      type: 'no_filter',
    };
  }

  // not all filters were selected, so the next state is to select all the remaining filters
  return {
    type: 'active_filter',
    operationNames: new Set(operationNames),
  };
}

export default Filter;
