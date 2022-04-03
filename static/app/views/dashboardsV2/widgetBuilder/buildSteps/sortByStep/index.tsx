import styled from '@emotion/styled';

import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {t, tn} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Organization, SelectValue} from 'sentry/types';
import {DisplayType, WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetOrderOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {DataSet, RESULTS_LIMIT, SortDirection} from '../../utils';
import {BuildStep} from '../buildStep';

import {SortBySelectors} from './sortBySelectors';

interface Props {
  dataSet: DataSet;
  displayType: DisplayType;
  onLimitChange: (newLimit: number) => void;
  onSortByChange: (newSortBy: string) => void;
  organization: Organization;
  queries: WidgetQuery[];
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
}: Props) {
  const orderBy = queries[0].orderby;

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
                options={[...Array(RESULTS_LIMIT).keys()].map(resultLimit => {
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
            widgetType={widgetType}
            sortByOptions={
              dataSet !== DataSet.ISSUES
                ? generateOrderOptions({
                    widgetType,
                    widgetBuilderNewDesign: true,
                    columns: queries[0].columns,
                    aggregates: queries[0].aggregates,
                  })
                : generateIssueWidgetOrderOptions(
                    organization.features.includes('issue-list-trend-sort')
                  )
            }
            values={{
              sortDirection:
                orderBy[0] === '-'
                  ? SortDirection.HIGH_TO_LOW
                  : SortDirection.LOW_TO_HIGH,
              sortBy: orderBy[0] === '-' ? orderBy.substring(1, orderBy.length) : orderBy,
            }}
            onChange={({sortDirection, sortBy}) => {
              const newOrderBy =
                sortDirection === SortDirection.HIGH_TO_LOW ? `-${sortBy}` : sortBy;
              onSortByChange(newOrderBy);
            }}
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
