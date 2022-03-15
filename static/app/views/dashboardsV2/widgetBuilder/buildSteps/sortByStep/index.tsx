import {generateOrderOptions} from 'sentry/components/dashboards/widgetQueriesForm';
import Field from 'sentry/components/forms/field';
import SelectControl from 'sentry/components/forms/selectControl';
import {t} from 'sentry/locale';
import {Organization, SelectValue} from 'sentry/types';
import {WidgetQuery, WidgetType} from 'sentry/views/dashboardsV2/types';
import {generateIssueWidgetOrderOptions} from 'sentry/views/dashboardsV2/widgetBuilder/issueWidget/utils';
import {IssueSortOptions} from 'sentry/views/issueList/utils';

import {DataSet, SortDirection} from '../../utils';
import {BuildStep} from '../buildStep';

import {SortBySelectors} from './sortBySelectors';

interface Props {
  dataSet: DataSet;
  onQueryChange: (queryIndex: number, newQuery: WidgetQuery) => void;
  organization: Organization;
  queries: WidgetQuery[];
  widgetBuilderNewDesign: boolean;
  widgetType: WidgetType;
  error?: string;
}

export function SortByStep({
  onQueryChange,
  queries,
  dataSet,
  widgetBuilderNewDesign,
  widgetType,
  organization,
  error,
}: Props) {
  const orderBy = queries[0].orderby;

  return (
    <BuildStep
      title={t('Sort by a column')}
      description={t("Choose one of the columns you've created to sort by.")}
    >
      <Field inline={false} error={error} flexibleControlStateSize stacked>
        {widgetBuilderNewDesign ? (
          <SortBySelectors
            sortByOptions={
              dataSet === DataSet.EVENTS
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
              const newQuery: WidgetQuery = {
                ...queries[0],
                orderby:
                  sortDirection === SortDirection.HIGH_TO_LOW ? `-${sortBy}` : sortBy,
              };
              onQueryChange(0, newQuery);
            }}
          />
        ) : (
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
              const newQuery: WidgetQuery = {
                ...queries[0],
                orderby: option.value,
              };
              onQueryChange(0, newQuery);
            }}
          />
        )}
      </Field>
    </BuildStep>
  );
}
