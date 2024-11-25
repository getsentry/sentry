import {useEffect} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';

import SelectControl from 'sentry/components/forms/controls/selectControl';
import FieldGroup from 'sentry/components/forms/fieldGroup';
import {Tooltip} from 'sentry/components/tooltip';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SelectValue} from 'sentry/types/core';
import type {TagCollection} from 'sentry/types/group';
import {getDatasetConfig} from 'sentry/views/dashboards/datasetConfig/base';
import type {WidgetQuery, WidgetType} from 'sentry/views/dashboards/types';
import {DisplayType} from 'sentry/views/dashboards/types';
import type {DataSet} from 'sentry/views/dashboards/widgetBuilder/utils';
import {
  getResultsLimit,
  SortDirection,
} from 'sentry/views/dashboards/widgetBuilder/utils';

import {BuildStep} from '../buildStep';

import {SortBySelectors} from './sortBySelectors';

export const CUSTOM_EQUATION_VALUE = 'custom-equation';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onLimitChange: (newLimit: number) => void;
  onSortByChange: (newSortBy: string) => void;
  queries: WidgetQuery[];
  tags: TagCollection;
  widgetType: WidgetType;
  error?: string;
  limit?: number;
}

export function SortByStep({
  displayType,
  onSortByChange,
  queries,
  widgetType,
  error,
  limit,
  onLimitChange,
  tags,
}: Props) {
  const datasetConfig = getDatasetConfig(widgetType);

  let disableSort = false;
  let disableSortDirection = false;
  let disableSortReason: string | undefined = undefined;

  if (datasetConfig.disableSortOptions) {
    ({disableSort, disableSortDirection, disableSortReason} =
      datasetConfig.disableSortOptions(queries[0]));
  }

  const orderBy = queries[0].orderby;
  const strippedOrderBy = trimStart(orderBy, '-');
  const maxLimit = getResultsLimit(queries.length, queries[0].aggregates.length);

  const isTimeseriesChart = [
    DisplayType.LINE,
    DisplayType.BAR,
    DisplayType.AREA,
  ].includes(displayType);

  useEffect(() => {
    if (!limit) {
      return;
    }
    if (limit > maxLimit) {
      onLimitChange(maxLimit);
    }
  }, [limit, maxLimit, onLimitChange]);

  return (
    <BuildStep
      title={
        displayType === DisplayType.TABLE ? t('Sort by a column') : t('Sort by a y-axis')
      }
      description={
        displayType === DisplayType.TABLE
          ? t("Choose one of the columns you've created to sort by.")
          : t("Choose one of the y-axis you've created to sort by.")
      }
      data-test-id="sort-by-step"
    >
      <Tooltip
        title={disableSortReason}
        disabled={!(disableSortDirection && disableSort)}
      >
        <FieldGroup inline={false} error={error} flexibleControlStateSize stacked>
          {[DisplayType.AREA, DisplayType.BAR, DisplayType.LINE].includes(displayType) &&
            limit && (
              <ResultsLimitSelector
                disabled={disableSortDirection && disableSort}
                name="resultsLimit"
                menuPlacement="auto"
                options={[...Array(maxLimit).keys()].map(resultLimit => {
                  const value = resultLimit + 1;
                  return {
                    label: tn('Limit to %s result', 'Limit to %s results', value),
                    value,
                  };
                })}
                value={limit}
                onChange={(option: SelectValue<number>) => {
                  onLimitChange(option.value);
                }}
              />
            )}
          <SortBySelectors
            displayType={displayType}
            widgetType={widgetType}
            hasGroupBy={isTimeseriesChart && !!queries[0].columns.length}
            disableSortReason={disableSortReason}
            disableSort={disableSort}
            disableSortDirection={disableSortDirection}
            widgetQuery={queries[0]}
            values={{
              sortDirection:
                orderBy[0] === '-'
                  ? SortDirection.HIGH_TO_LOW
                  : SortDirection.LOW_TO_HIGH,
              sortBy: strippedOrderBy,
            }}
            onChange={({sortDirection, sortBy}) => {
              const newOrderBy =
                sortDirection === SortDirection.HIGH_TO_LOW ? `-${sortBy}` : sortBy;
              onSortByChange(newOrderBy);
            }}
            tags={tags}
          />
        </FieldGroup>
      </Tooltip>
    </BuildStep>
  );
}

const ResultsLimitSelector = styled(SelectControl)`
  margin-bottom: ${space(1)};
`;
