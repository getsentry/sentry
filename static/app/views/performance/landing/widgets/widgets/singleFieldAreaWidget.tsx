import {Fragment, FunctionComponent, useMemo} from 'react';
import {withRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'app/components/charts/eventsRequest';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import _DurationChart from 'app/views/performance/charts/chart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformEventsRequestToArea} from '../transforms/transformEventsToArea';
import {WidgetDataResult} from '../types';

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

type AreaDataType = {
  chart: WidgetDataResult & ReturnType<typeof transformEventsRequestToArea>;
};

export function SingleFieldAreaWidget(props: Props) {
  const {ContainerActions} = props;
  const globalSelection = props.eventView.getGlobalSelection();

  if (props.fields.length !== 1) {
    throw new Error(`Single field area can only accept a single field (${props.fields})`);
  }

  const Queries = useMemo(() => {
    return {
      chart: {
        fields: props.fields[0],
        component: provided => (
          <EventsRequest
            {...provided}
            limit={1}
            includePrevious
            includeTransformedData
            partial
            currentSeriesName={props.fields[0]}
            eventView={props.eventView}
            query={props.eventView.getQueryWithAdditionalConditions()}
          />
        ),
        transform: transformEventsRequestToArea,
      },
    };
  }, [props.eventView.query, props.fields[0], props.organization.slug]);

  return (
    <GenericPerformanceWidget<AreaDataType>
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
