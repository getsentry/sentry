import {useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';
import uniqBy from 'lodash/uniqBy';

import {Select} from 'sentry/components/core/select';
import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {
  EQUATION_PREFIX,
  explodeField,
  generateFieldAsString,
  getEquation,
  isEquation,
  isEquationAlias,
  parseFunction,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery} from 'sentry/views/dashboards/types';
import {DisplayType, WidgetType} from 'sentry/views/dashboards/types';
import {ExploreArithmeticBuilder} from 'sentry/views/dashboards/widgetBuilder/components/exploreArithmeticBuilder';
import {getColumnOptions} from 'sentry/views/dashboards/widgetBuilder/components/visualize';
import {
  sortDirections,
  type SortDirection,
} from 'sentry/views/dashboards/widgetBuilder/utils';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {QueryField} from 'sentry/views/discover/table/queryField';
import type {FieldValue} from 'sentry/views/discover/table/types';
import {FieldValueKind} from 'sentry/views/discover/table/types';

export const CUSTOM_EQUATION_VALUE = 'custom-equation';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
}

interface Props {
  displayType: DisplayType;
  onChange: (values: Values) => void;
  tags: TagCollection;
  values: Values;
  widgetQuery: WidgetQuery;
  widgetType: WidgetType;
  disableSort?: boolean;
  disableSortDirection?: boolean;
  disableSortReason?: string;
  hasGroupBy?: boolean;
}

// Lock the sort by parameter option when the value is `count(span.duration)`
// because we do not want to expose the concept of counting by other fields
const LOCKED_SPAN_COUNT_SORT = 'count(span.duration)';

export function SortBySelectors({
  values,
  widgetType,
  onChange,
  disableSortReason,
  disableSort,
  disableSortDirection,
  widgetQuery,
  displayType,
  tags,
}: Props) {
  const datasetConfig = getDatasetConfig(widgetType);
  const organization = useOrganization();
  const columnSet = new Set(widgetQuery.columns);
  const [showCustomEquation, setShowCustomEquation] = useState(false);
  const [customEquation, setCustomEquation] = useState<Values>({
    sortBy: `${EQUATION_PREFIX}`,
    sortDirection: values.sortDirection,
  });
  useEffect(() => {
    const isSortingByEquation = isEquation(trimStart(values.sortBy, '-'));
    if (isSortingByEquation) {
      setCustomEquation({
        sortBy: trimStart(values.sortBy, '-'),
        sortDirection: values.sortDirection,
      });
    }
    setShowCustomEquation(isSortingByEquation);
  }, [values.sortBy, values.sortDirection]);

  const timeseriesSortOptions = useMemo(() => {
    let options: Record<string, SelectValue<FieldValue>> = {};
    if (displayType !== DisplayType.TABLE) {
      options = datasetConfig.getTimeseriesSortOptions!(organization, widgetQuery, tags);
      const parsedFunction = parseFunction(values.sortBy);
      if (
        widgetType === WidgetType.SPANS &&
        parsedFunction?.name === 'count' &&
        options['measurement:span.duration']
      ) {
        // Re-map the span duration measurement label so we can simply render
        // `spans` in the parameter UI
        options['measurement:span.duration'] = {
          ...options['measurement:span.duration'],
          label: t('spans'),
        };
      }
    }
    return options;
  }, [
    datasetConfig,
    organization,
    tags, // This dependency is unstable!
    widgetQuery, // This dependency is unstable!
    widgetType,
    displayType,
    values.sortBy,
  ]);

  return (
    <Wrapper>
      <Tooltip
        title={disableSortReason}
        disabled={!disableSortDirection || (disableSortDirection && disableSort)}
      >
        <Select
          name="sortDirection"
          aria-label={t('Sort direction')}
          disabled={disableSortDirection}
          options={Object.keys(sortDirections).map(value => ({
            // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
            label: sortDirections[value],
            value,
          }))}
          value={values.sortDirection}
          onChange={(option: SelectValue<SortDirection>) => {
            onChange({
              sortBy: values.sortBy,
              sortDirection: option.value,
            });
          }}
        />
      </Tooltip>
      <Tooltip
        title={disableSortReason}
        disabled={!disableSort || (disableSortDirection && disableSort)}
      >
        {
          // Trace Metrics also uses the table sort options because it constrains the options to the selected
          // group bys and aggregate which is consistent for the explore page (i.e. you can't sort by a field
          // that is not in the group bys or aggregate).
          displayType === DisplayType.TABLE ||
          displayType === DisplayType.DETAILS ||
          widgetType === WidgetType.TRACEMETRICS ? (
            <Select
              name="sortBy"
              aria-label={t('Sort by')}
              disabled={disableSort}
              placeholder={`${t('Select a column')}\u{2026}`}
              value={values.sortBy}
              options={uniqBy(
                datasetConfig.getTableSortOptions!(organization, widgetQuery),
                ({value}) => value
              )}
              onChange={(option: SelectValue<string>) => {
                onChange({
                  sortBy: option.value,
                  sortDirection: values.sortDirection,
                });
              }}
            />
          ) : (
            <QueryField
              disabled={disableSort}
              fieldValue={
                // Fields in metrics widgets would parse as function in explodeField
                widgetType === WidgetType.METRICS
                  ? {kind: 'field', field: values.sortBy}
                  : showCustomEquation
                    ? explodeField({field: CUSTOM_EQUATION_VALUE})
                    : explodeField({field: values.sortBy})
              }
              fieldOptions={timeseriesSortOptions}
              filterPrimaryOptions={
                datasetConfig.filterSeriesSortOptions
                  ? datasetConfig.filterSeriesSortOptions(columnSet)
                  : undefined
              }
              filterAggregateParameters={datasetConfig.filterAggregateParams}
              disableParameterSelector={
                widgetType === WidgetType.SPANS &&
                values.sortBy === LOCKED_SPAN_COUNT_SORT
              }
              onChange={value => {
                if (value.alias && isEquationAlias(value.alias)) {
                  onChange({
                    sortBy: value.alias,
                    sortDirection: values.sortDirection,
                  });
                  return;
                }

                let parsedValue = generateFieldAsString(value);
                const isSortingByCustomEquation = isEquation(parsedValue);
                setShowCustomEquation(isSortingByCustomEquation);
                if (isSortingByCustomEquation) {
                  onChange(customEquation);
                  return;
                }
                if (
                  widgetType === WidgetType.SPANS &&
                  value.kind === FieldValueKind.FUNCTION
                ) {
                  // A spans function is selected, check if the argument is compatible with the function
                  const functionName = value.function[0];
                  const newValidOptions = getColumnOptions(
                    widgetType,
                    value,
                    timeseriesSortOptions,
                    datasetConfig.filterAggregateParams ?? (() => true),
                    true
                  );
                  const newOptionSet = new Set(
                    newValidOptions.map(option => option.value)
                  );
                  const newFunctionOption =
                    timeseriesSortOptions[`function:${functionName}`];
                  if (
                    value.function[1] &&
                    !newOptionSet.has(value.function[1]) &&
                    newFunctionOption?.value?.kind === FieldValueKind.FUNCTION
                  ) {
                    // Select the default value if it exists, otherwise get the first option from
                    // the new valid options
                    const defaultValue: string =
                      newFunctionOption.value?.meta?.parameters?.[0]?.defaultValue ??
                      newValidOptions[0]?.value ??
                      '';
                    parsedValue = `${functionName}(${defaultValue})`;
                  }
                }
                onChange({
                  sortBy: parsedValue,
                  sortDirection: values.sortDirection,
                });
              }}
              useMenuPortal
            />
          )
        }
      </Tooltip>
      {showCustomEquation && (
        <ArithmeticInputWrapper>
          {widgetType === WidgetType.SPANS ? (
            <ExploreArithmeticBuilder
              equation={getEquation(customEquation.sortBy)}
              onUpdate={value => {
                const newValue = {
                  sortBy: `${EQUATION_PREFIX}${value}`,
                  sortDirection: values.sortDirection,
                };
                onChange(newValue);
                setCustomEquation(newValue);
              }}
            />
          ) : (
            <ArithmeticInput
              name="arithmetic"
              type="text"
              placeholder={t('Enter Equation')}
              value={getEquation(customEquation.sortBy)}
              onUpdate={value => {
                const newValue = {
                  sortBy: `${EQUATION_PREFIX}${value}`,
                  sortDirection: values.sortDirection,
                };
                onChange(newValue);
                setCustomEquation(newValue);
              }}
              hideFieldOptions
            />
          )}
        </ArithmeticInputWrapper>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 200px 1fr;
  }
`;

const ArithmeticInputWrapper = styled('div')`
  grid-column: 1/-1;
`;
