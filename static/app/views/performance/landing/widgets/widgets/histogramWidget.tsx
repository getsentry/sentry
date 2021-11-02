import {Fragment, FunctionComponent, useMemo} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import _EventsRequest from 'app/components/charts/eventsRequest';
import {t} from 'app/locale';
import {Organization} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import HistogramQuery from 'app/utils/performance/histogram/histogramQuery';
import {Chart as HistogramChart} from 'app/views/performance/landing/chart/histogramChart';

import {GenericPerformanceWidget} from '../components/performanceWidget';
import {transformHistogramQuery} from '../transforms/transformHistogramQuery';
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
  chart: WidgetDataResult & ReturnType<typeof transformHistogramQuery>;
};

export function HistogramWidget(props: Props) {
  const {ContainerActions, location} = props;
  const globalSelection = props.eventView.getGlobalSelection();

  const Queries = useMemo(() => {
    return {
      chart: {
        fields: props.fields,
        component: provided => (
          <HistogramQuery
            {...provided}
            eventView={props.eventView}
            location={props.location}
            numBuckets={20}
            dataFilter="exclude_outliers"
          />
        ),
        transform: transformHistogramQuery,
      },
    };
  }, [props.eventView.query, props.fields[0], props.organization.slug]);

  const onFilterChange = () => {};

  return (
    <GenericPerformanceWidget<AreaDataType>
      {...props}
      Subtitle={() => (
        <Subtitle>{t('Compared to last %s ', globalSelection.datetime.period)}</Subtitle>
      )}
      HeaderActions={provided => (
        <Fragment>
          <ContainerActions {...provided.widgetData.chart} />
        </Fragment>
      )}
      Queries={Queries}
      Visualizations={[
        {
          component: provided => (
            <HistogramChart
              {...provided}
              colors={props.chartColor ? [props.chartColor] : undefined}
              height={100}
              location={location}
              isLoading={false}
              isErrored={false}
              onFilterChange={onFilterChange}
              field={props.fields[0]}
              chartData={provided.widgetData.chart?.data?.[props.fields[0]]}
              disableXAxis
            />
          ),
          height: 160,
        },
      ]}
    />
  );
}

const Subtitle = styled('span')`
  color: ${p => p.theme.gray300};
  font-size: ${p => p.theme.fontSizeMedium};
`;
