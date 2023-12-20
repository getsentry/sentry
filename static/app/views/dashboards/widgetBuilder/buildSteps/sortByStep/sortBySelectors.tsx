import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';
import uniqBy from 'lodash/uniqBy';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import {Tooltip} from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {SelectValue, TagCollection} from 'sentry/types';
import {
  EQUATION_PREFIX,
  explodeField,
  generateFieldAsString,
  getEquation,
  isEquation,
  isEquationAlias,
} from 'sentry/utils/discover/fields';
import useOrganization from 'sentry/utils/useOrganization';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboards/types';
import {SortDirection, sortDirections} from 'sentry/views/dashboards/widgetBuilder/utils';
import ArithmeticInput from 'sentry/views/discover/table/arithmeticInput';
import {QueryField} from 'sentry/views/discover/table/queryField';

import {CUSTOM_EQUATION_VALUE} from '.';

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

export function SortBySelectors({
  values,
  widgetType,
  onChange,
  disableSortReason,
  disableSort,
  disableSortDirection,
  widgetQuery,
  displayType,
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

  return (
    <Wrapper>
      <Tooltip
        title={disableSortReason}
        disabled={!disableSortDirection || (disableSortDirection && disableSort)}
      >
        <SelectControl
          name="sortDirection"
          aria-label="Sort direction"
          menuPlacement="auto"
          disabled={disableSortDirection}
          options={Object.keys(sortDirections).map(value => ({
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
        {displayType === DisplayType.TABLE ? (
          <SelectControl
            name="sortBy"
            aria-label="Sort by"
            menuPlacement="auto"
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
              showCustomEquation
                ? explodeField({field: CUSTOM_EQUATION_VALUE})
                : explodeField({field: values.sortBy})
            }
            fieldOptions={datasetConfig.getTimeseriesSortOptions!(
              organization,
              widgetQuery
            )}
            filterPrimaryOptions={
              datasetConfig.filterSeriesSortOptions
                ? datasetConfig.filterSeriesSortOptions(columnSet)
                : undefined
            }
            filterAggregateParameters={datasetConfig.filterAggregateParams}
            placeholder={widgetType === WidgetType.METRICS ? t('(tag)') : undefined}
            onChange={value => {
              if (value.alias && isEquationAlias(value.alias)) {
                onChange({
                  sortBy: value.alias,
                  sortDirection: values.sortDirection,
                });
                return;
              }

              const parsedValue = generateFieldAsString(value);
              const isSortingByCustomEquation = isEquation(parsedValue);
              setShowCustomEquation(isSortingByCustomEquation);
              if (isSortingByCustomEquation) {
                onChange(customEquation);
                return;
              }

              onChange({
                sortBy: parsedValue,
                sortDirection: values.sortDirection,
              });
            }}
          />
        )}
      </Tooltip>
      {showCustomEquation && (
        <ArithmeticInputWrapper>
          <ArithmeticInput
            name="arithmetic"
            type="text"
            required
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
        </ArithmeticInputWrapper>
      )}
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  gap: ${space(1)};

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 200px 1fr;
  }
`;

const ArithmeticInputWrapper = styled('div')`
  grid-column: 1/-1;
`;
