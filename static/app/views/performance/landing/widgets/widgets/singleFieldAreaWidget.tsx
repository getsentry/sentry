import {Fragment, FunctionComponent, useMemo} from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';
import pick from 'lodash/pick';

import _EventsRequest from 'app/components/charts/eventsRequest';
import {getInterval} from 'app/components/charts/utils';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import _DurationChart from 'app/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {QueryDefinition, WidgetDataResult} from '../types';

type Props = {
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
        <EventsRequest
          {...pick(provided, ['children', 'organization', 'yAxis'])}
          limit={1}
          includePrevious
          includeTransformedData
          partial
          currentSeriesNames={[field]}
          query={props.eventView.getQueryWithAdditionalConditions()}
          interval={getInterval(
            {
              start: provided.start,
              end: provided.end,
              period: provided.period,
            },
            'medium'
          )}
        />
      ),
      transform: transformEventsRequestToArea,
    }),
    [props.eventView, field, props.organization.slug]
  );

  const Queries = {
    chart,
  };

  return (
    <GenericPerformanceWidget<DataType>
      {...props}
      Subtitle={() => (
        <Subtitle>{t('Compared to last %s ', globalSelection.datetime.period)}</Subtitle>
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
