import {useCallback, useLayoutEffect, useMemo, useRef} from 'react';
import {useQuery} from '@tanstack/react-query';
import isEqual from 'lodash/isEqual';

import type {SelectOption} from '@sentry/scraps/compactSelect';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {usePageFilters} from 'sentry/components/pageFilters/usePageFilters';
import {t} from 'sentry/locale';
import type {TagCollection} from 'sentry/types/group';
import {FieldKind} from 'sentry/utils/fields';
import {useOrganization} from 'sentry/utils/useOrganization';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {useGroupByFields} from 'sentry/views/explore/hooks/useGroupByFields';
import {HiddenTraceMetricGroupByFields} from 'sentry/views/explore/metrics/constants';
import {useValidateMetricsTab} from 'sentry/views/explore/metrics/hooks/useValidateMetricsTab';
import type {TraceMetric} from 'sentry/views/explore/metrics/metricQuery';
import {createTraceMetricFilter} from 'sentry/views/explore/metrics/utils';
import {
  useQueryParamsGroupBys,
  useSetQueryParamsGroupBys,
} from 'sentry/views/explore/queryParams/context';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {sortSearchedAttributes} from 'sentry/views/explore/utils/sortSearchedAttributes';
import {
  selectTraceItemTagCollection,
  traceItemAttributeKeysOptions,
} from 'sentry/views/explore/utils/traceItemAttributeKeysOptions';
import type {EventValidationData} from 'sentry/views/explore/utils/validateEventParamsOptions';

interface GroupBySelectorProps {
  /**
   * The metric to filter attributes by
   */
  traceMetric: TraceMetric;
  /**
   * If set, disables the selector and shows this string as a tooltip.
   */
  disabledReason?: string;
  /**
   * Whether to skip the trace metric filter.
   *
   * For equations, because at the moment there isn't an easy way to filter
   * the attributes to the relevant attributes.
   */
  skipTraceMetricFilter?: boolean;
}

/**
 * A selector component for choosing metric group by attributes.
 * Fetches available attribute keys from the trace-items API endpoint
 * and displays them as options in a compact select dropdown.
 */
export function GroupBySelector({
  traceMetric,
  skipTraceMetricFilter,
  disabledReason,
}: GroupBySelectorProps) {
  const {selection} = usePageFilters();
  const organization = useOrganization();
  const groupBys = useQueryParamsGroupBys();
  const setGroupBys = useSetQueryParamsGroupBys();
  const isDisabled = disabledReason !== undefined;
  const {
    data: validatedSearchQueryData,
    isFetching: validationFetching,
    isLoading: validationLoading,
    isPlaceholderData: validationIsPlaceholderData,
  } = useValidateMetricsTab();
  const pendingValidatedGroupBys = useRef<{
    from: readonly string[];
    to: readonly string[];
  } | null>(null);
  const validationGroupBys = useRef<{
    data: EventValidationData;
    groupBys: readonly string[];
  } | null>(null);
  const validationIsPending =
    validationFetching || validationLoading || validationIsPlaceholderData;

  const validatedGroupBys = useMemo(
    () => filterInvalidGroupBys(groupBys, validatedSearchQueryData?.field),
    [groupBys, validatedSearchQueryData?.field]
  );
  const visibleGroupBys = useMemo(
    () =>
      filterVisibleGroupBys(
        groupBys,
        validatedSearchQueryData?.field,
        validationIsPending
      ),
    [groupBys, validatedSearchQueryData?.field, validationIsPending]
  );

  useLayoutEffect(() => {
    if (pendingValidatedGroupBys.current) {
      if (isEqual(groupBys, pendingValidatedGroupBys.current.to)) {
        pendingValidatedGroupBys.current = null;
      } else if (
        isEqual(groupBys, pendingValidatedGroupBys.current.from) &&
        isEqual(validatedGroupBys, pendingValidatedGroupBys.current.to)
      ) {
        return;
      }
    }

    if (validationIsPending || !validatedSearchQueryData) {
      return;
    }

    let validationGroupBySnapshot = validationGroupBys.current;
    if (
      !validationGroupBySnapshot?.data ||
      validationGroupBySnapshot.data !== validatedSearchQueryData
    ) {
      validationGroupBySnapshot = {
        data: validatedSearchQueryData,
        groupBys,
      };
      validationGroupBys.current = validationGroupBySnapshot;
    }

    if (
      !isEqual(groupBys, validationGroupBySnapshot.groupBys) ||
      isEqual(groupBys, validatedGroupBys)
    ) {
      return;
    }

    pendingValidatedGroupBys.current = {
      from: groupBys,
      to: validatedGroupBys,
    };
    setGroupBys(validatedGroupBys);
  }, [
    groupBys,
    setGroupBys,
    validatedGroupBys,
    validatedSearchQueryData,
    validationIsPending,
  ]);

  const traceMetricFilter = createTraceMetricFilter(traceMetric);

  const {data, isLoading} = useQuery({
    ...traceItemAttributeKeysOptions({
      organization,
      selection,
      traceItemType: TraceItemDataset.TRACEMETRICS,
      query: skipTraceMetricFilter ? undefined : traceMetricFilter,
    }),
    select: selectTraceItemTagCollection(),
    enabled: skipTraceMetricFilter || Boolean(traceMetricFilter),
  });

  const {validatedBooleanTags, validatedNumberTags, validatedStringTags} = useMemo(() => {
    const visibleBooleanTags = Object.fromEntries(
      Object.entries(data?.booleanAttributes ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
    const visibleNumberTags = Object.fromEntries(
      Object.entries(data?.numberAttributes ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );
    const visibleStringTags = Object.fromEntries(
      Object.entries(data?.stringAttributes ?? {}).filter(
        ([key]) => !HiddenTraceMetricGroupByFields.includes(key)
      )
    );

    return mergeValidatedTags({
      booleanTags: visibleBooleanTags,
      numberTags: visibleNumberTags,
      stringTags: visibleStringTags,
      validatedFields: validatedSearchQueryData?.field.filter(
        field => field.valid && groupBys.includes(field.name)
      ),
    });
  }, [
    data?.booleanAttributes,
    data?.numberAttributes,
    data?.stringAttributes,
    groupBys,
    validatedSearchQueryData?.field,
  ]);

  const enabledOptions = useGroupByFields({
    groupBys: visibleGroupBys,
    numberTags: validatedNumberTags,
    stringTags: validatedStringTags,
    booleanTags: validatedBooleanTags,
    traceItemType: TraceItemDataset.TRACEMETRICS,
    hideEmptyOption: true,
  });

  const handleChange = useCallback(
    (selectedOptions: Array<SelectOption<string>>) => {
      const newGroupBys = selectedOptions.map(option => option.value);
      // Check if any new items were added (not present in the old groupBys)
      const hasNewItems = newGroupBys.some(value => !groupBys.includes(value));
      // Automatically switch to aggregates mode when a group by is inserted/updated
      if (hasNewItems) {
        setGroupBys(newGroupBys, Mode.AGGREGATE);
      } else {
        setGroupBys(newGroupBys);
      }
    },
    [groupBys, setGroupBys]
  );

  return (
    <CompactSelect
      multiple
      search={{
        highlight: true,
        filter: (option, searchText) => {
          return sortSearchedAttributes({
            fieldDefinitionType: TraceItemDataset.TRACEMETRICS,
            option,
            searchText,
          });
        },
      }}
      clearable
      trigger={triggerProps => (
        <OverlayTrigger.Button
          {...triggerProps}
          tooltipProps={{title: disabledReason}}
          prefix={t('Group by')}
          style={{width: '100%'}}
        />
      )}
      options={enabledOptions}
      value={visibleGroupBys}
      loading={isLoading || validationIsPending}
      disabled={
        isDisabled ||
        isLoading ||
        validationIsPending ||
        (!skipTraceMetricFilter && !traceMetricFilter)
      }
      onChange={handleChange}
      style={{width: '100%'}}
    />
  );
}

function filterInvalidGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined
): string[] {
  const invalidFields = new Set(
    fields?.filter(field => !field.valid).map(field => field.name)
  );

  if (invalidFields.size === 0) {
    return [...groupBys];
  }

  return groupBys.filter(groupBy => groupBy === '' || !invalidFields.has(groupBy));
}

function filterVisibleGroupBys(
  groupBys: readonly string[],
  fields: EventValidationData['field'] | undefined,
  validationIsPending: boolean
): string[] {
  return groupBys.filter(groupBy => {
    if (groupBy === '') {
      return true;
    }

    const field = fields?.find(({name}) => name === groupBy);
    return field?.valid || (!validationIsPending && field?.valid !== false);
  });
}

function mergeValidatedTags({
  booleanTags,
  numberTags,
  stringTags,
  validatedFields = [],
}: {
  booleanTags: TagCollection;
  numberTags: TagCollection;
  stringTags: TagCollection;
  validatedFields?: EventValidationData['field'];
}) {
  const validatedBooleanTags = {...booleanTags};
  const validatedNumberTags = {...numberTags};
  const validatedStringTags = {...stringTags};

  for (const validatedField of validatedFields) {
    const tag = {
      key: validatedField.name,
      name: prettifyAttributeName(validatedField.name),
    };

    if (validatedField.attrType === 'boolean') {
      validatedBooleanTags[validatedField.name] = {...tag, kind: FieldKind.BOOLEAN};
    } else if (validatedField.attrType === 'number') {
      validatedNumberTags[validatedField.name] = {...tag, kind: FieldKind.MEASUREMENT};
    } else if (validatedField.attrType === 'string') {
      validatedStringTags[validatedField.name] = {...tag, kind: FieldKind.TAG};
    }
  }

  return {validatedBooleanTags, validatedNumberTags, validatedStringTags};
}
