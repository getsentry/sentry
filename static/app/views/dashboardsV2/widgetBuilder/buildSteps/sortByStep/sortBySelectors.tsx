import React, {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';
import uniqBy from 'lodash/uniqBy';

import SelectControl from 'sentry/components/forms/selectControl';
import Tooltip from 'sentry/components/tooltip';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
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
import {getDatasetConfig} from 'sentry/views/dashboardsV2/datasetConfig/base';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {
  SortDirection,
  sortDirections,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import ArithmeticInput from 'sentry/views/eventsV2/table/arithmeticInput';
import {QueryField} from 'sentry/views/eventsV2/table/queryField';

import {CUSTOM_EQUATION_VALUE} from '.';

interface Values {
  sortBy: string;
  sortDirection: SortDirection;
}

interface Props {
  displayType: DisplayType;
  filterPrimaryOptions: React.ComponentProps<typeof QueryField>['filterPrimaryOptions'];
  onChange: (values: Values) => void;
  sortByOptions: SelectValue<string>[];
  tags: TagCollection;
  values: Values;
  widgetQuery: WidgetQuery;
  widgetType: WidgetType;
  disabledReason?: string;
  disabledSort?: boolean;
  disabledSortDirection?: boolean;
  hasGroupBy?: boolean;
}

export function SortBySelectors({
  values,
  sortByOptions,
  widgetType,
  onChange,
  disabledReason,
  disabledSort,
  disabledSortDirection,
  widgetQuery,
  displayType,
}: Props) {
  const datasetConfig = getDatasetConfig(widgetType);
  const organization = useOrganization();
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

  function getSortByField() {
    if (![DisplayType.TABLE, DisplayType.TOP_N].includes(displayType)) {
      return (
        <Tooltip
          title={disabledReason}
          disabled={!disabledSort || (disabledSortDirection && disabledSort)}
        >
          <QueryField
            disabled={disabledSort}
            fieldValue={
              showCustomEquation
                ? explodeField({field: CUSTOM_EQUATION_VALUE})
                : explodeField({field: values.sortBy})
            }
            fieldOptions={datasetConfig.getTimeseriesSortOptions!(
              organization,
              widgetQuery
            )}
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
        </Tooltip>
      );
    }
    return (
      <Tooltip
        title={disabledReason}
        disabled={!disabledSort || (disabledSortDirection && disabledSort)}
      >
        <SelectControl
          name="sortBy"
          aria-label="Sort by"
          menuPlacement="auto"
          disabled={disabledSort}
          placeholder={`${t('Select a column')}\u{2026}`}
          value={values.sortBy}
          options={uniqBy(sortByOptions, ({value}) => value)}
          onChange={(option: SelectValue<string>) => {
            onChange({
              sortBy: option.value,
              sortDirection: values.sortDirection,
            });
          }}
        />
      </Tooltip>
    );
  }

  return (
    <Tooltip title={disabledReason} disabled={!(disabledSortDirection && disabledSort)}>
      <Wrapper>
        <Tooltip
          title={disabledReason}
          disabled={!disabledSortDirection || (disabledSortDirection && disabledSort)}
        >
          <SelectControl
            name="sortDirection"
            aria-label="Sort direction"
            menuPlacement="auto"
            disabled={disabledSortDirection}
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
        {getSortByField()}
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
    </Tooltip>
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
