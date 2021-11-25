import {Fragment, FunctionComponent, useMemo} from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import _EventsRequest from 'sentry/components/charts/eventsRequest';
import {getInterval} from 'sentry/components/charts/utils';
import {t} from 'sentry/locale';
import {Organization} from 'sentry/types';
import EventView from 'sentry/utils/discover/eventView';
import {QueryBatchNode} from 'sentry/utils/performance/contexts/genericQueryBatcher';
import withApi from 'sentry/utils/withApi';
import _DurationChart from 'sentry/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {QueryDefinition, WidgetDataResult} from '../types';
import {eventsRequestQueryProps} from '../utils';
import {ChartDefinition, PerformanceWidgetSetting} from '../widgetDefinitions';

type Props = {
  chartSetting: PerformanceWidgetSetting;
  chartDefinition: ChartDefinition;

  title: string;
  titleTooltip: string;
  fields: string[];
  chartColor?: string;

  eventView: EventView;
  location: Location;
  organization: Organization;

  ContainerActions: FunctionComponent<{isLoading: boolean}>;
};

type DataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
};

export function SingleFieldAreaWidget(props: Props) {
  const {ContainerActions} = props;
  const globalSelection = props.eventView.getGlobalSelection();

  if (props.fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${props.fields})`);
  }
  const field = props.fields[0];

  const chart = useMemo<QueryDefinition<DataType, WidgetDataResult>>(
    () => ({
      fields: props.fields[0],
      component: provided => (
        <QueryBatchNode batchProperty="yAxis">
          {({queryBatching}) => (
            <EventsRequest
              {...pick(provided, eventsRequestQueryProps)}
              limit={1}
              queryBatching={queryBatching}
              includePrevious
              includeTransformedData
              partial
              currentSeriesNames={[field]}
              previousSeriesNames={[`previous ${field}`]}
              query={provided.eventView.getQueryWithAdditionalConditions()}
              interval={getInterval(
                {
                  start: provided.start,
                  end: provided.end,
                  period: provided.period,
                },
                'medium'
              )}
            />
          )}
        </QueryBatchNode>
      ),
      transform: transformEventsRequestToArea,
    }),
    [props.chartSetting]
  );

  const Queries = {
    chart,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={() => (
        <Subtitle>
          {globalSelection.datetime.period
            ? t('Compared to last %s ', globalSelection.datetime.period)
            : t('Compared to the last period')}
        </Subtitle>
      )}
      HeaderActions={provided => (
        <Fragment>
          <HighlightNumber color={props.chartColor}>
            {provided.widgetData.chart?.hasData
              ? provided.widgetData.chart?.dataMean?.[0].label
              : null}
          </HighlightNumber>
          <ContainerActions {...provided.widgetData.chart} />
        </Fragment>
      )}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <DurationChart
              {...provided.widgetData.chart}
              {...provided}
              disableMultiAxis
              disableXAxis
              chartColors={props.chartColor ? [props.chartColor] : undefined}
            />
          ),
          height: 160,
        },
      ]}
    />
  );
}

const EventsRequest = withApi(_EventsRequest);
const DurationChart = withRouter(_DurationChart);
const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const HighlightNumber = styled('div')<{color?: string}>`
  color: ${p => p.color};
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;
