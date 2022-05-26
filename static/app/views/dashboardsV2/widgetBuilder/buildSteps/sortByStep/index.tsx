import {useEffect} from 'react';
import styled from '@emotion/styled';
import trimStart from 'lodash/trimStart';

import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SelectValue, TagCollection} from 'sentry/types';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetOrderOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {
  DataSet,
  filterPrimaryOptions as filterReleaseSortOptions,
  getResultsLimit,
  SortDirection,
} from 'sentry/views/dashboardsV2/widgetBuilder/utils';
import {FieldValueKind} from 'sentry/views/eventsV2/table/types';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {BuildStep} from '../buildStep';

import {SortBySelectors} from './sortBySelectors';

export const CUSTOM_EQUATION_VALUE = 'custom-equation';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onLimitChange: (newLimit: number) => void;
  onSortByChange: (newSortBy: string) => void;
  organization: Organization;
  queries: WidgetQuery[];
  tags: TagCollection;
  widgetBuilderNewDesign: boolean;
  widgetType: WidgetType;
  error?: string;
  limit?: number;
}

export function SortByStep({
  displayType,
  onSortByChange,
  queries,
  dataSet,
  widgetBuilderNewDesign,
  widgetType,
  organization,
  error,
  limit,
  onLimitChange,
  tags,
}: Props) {
  const fields = queries[0].columns;

  let disabledSort = false;
  let disabledSortDirection = false;
  let disabledReason: string | undefined = undefined;

  if (widgetType === WidgetType.RELEASE && fields.includes('session.status')) {
    disabledSort = true;
    disabledSortDirection = true;
    disabledReason = t('Sorting currently not supported with session.status');
  }

  if (widgetType === WidgetType.ISSUE) {
    disabledSortDirection = true;
    disabledReason = t('Issues dataset does not yet support descending order');
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
  }, [limit, maxLimit]);

  const columnSet = new Set(queries[0].columns);
  const filterDiscoverOptions = option => {
    if (
      option.value.kind === FieldValueKind.FUNCTION ||
      option.value.kind === FieldValueKind.EQUATION
    ) {
      return true;
    }

    return (
      columnSet.has(option.value.meta.name) ||
      option.value.meta.name === CUSTOM_EQUATION_VALUE
    );
  };

  const filterReleaseOptions = option => {
    if (['count_healthy', 'count_errored'].includes(option.value.meta.name)) {
      return false;
    }
    if (option.value.kind === FieldValueKind.TAG) {
      // Only allow sorting by release tag
      return (
        columnSet.has(option.value.meta.name) && option.value.meta.name === 'release'
      );
    }
    return filterReleaseSortOptions({
      option,
      widgetType,
      displayType: DisplayType.TABLE,
    });
  };

  if (widgetBuilderNewDesign) {
    return (
      <BuildStep
        title={
          displayType === DisplayType.TABLE
            ? t('Sort by a column')
            : t('Sort by a y-axis')
        }
        description={
          displayType === DisplayType.TABLE
            ? t("Choose one of the columns you've created to sort by.")
            : t("Choose one of the y-axis you've created to sort by.")
        }
      >
        <Field inline={false} error={error} flexibleControlStateSize stacked>
          {[DisplayType.AREA, DisplayType.BAR, DisplayType.LINE].includes(displayType) &&
            limit && (
              <ResultsLimitSelector
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
            disabledReason={disabledReason}
            disabledSort={disabledSort}
            disabledSortDirection={disabledSortDirection}
            sortByOptions={
              dataSet === DataSet.ISSUES
                ? generateIssueWidgetOrderOptions(
                    organization.features.includes('issue-list-trend-sort')
                  )
                : generateOrderOptions({
                    widgetType,
                    widgetBuilderNewDesign: true,
                    columns: queries[0].columns,
                    aggregates: queries[0].aggregates,
                  })
            }
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
            filterPrimaryOptions={
              dataSet === DataSet.RELEASES ? filterReleaseOptions : filterDiscoverOptions
            }
          />
        </Field>
      </BuildStep>
    );
  }

  return (
    <BuildStep
      title={t('Sort by a column')}
      description={t("Choose one of the columns you've created to sort by.")}
    >
      <Field inline={false} error={error} flexibleControlStateSize stacked>
        <SelectControl
          menuPlacement="auto"
          value={
            dataSet === DataSet.EVENTS
              ? queries[0].orderby
              : queries[0].orderby || IssueSortOptions.DATE
          }
          name="orderby"
          options={
            dataSet === DataSet.EVENTS
              ? generateOrderOptions({
                  widgetType,
                  columns: queries[0].columns,
                  aggregates: queries[0].aggregates,
                })
              : generateIssueWidgetOrderOptions(
                  organization.features.includes('issue-list-trend-sort')
                )
          }
          onChange={(option: SelectValue<string>) => {
            onSortByChange(option.value);
          }}
        />
      </Field>
    </BuildStep>
  );
}

const ResultsLimitSelector = styled(SelectControl)`
  margin-bottom: ${space(1)};
`;
