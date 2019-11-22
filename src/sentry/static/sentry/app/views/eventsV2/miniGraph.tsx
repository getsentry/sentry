import React from 'react';
import isEqual from 'lodash/isEqual';
import omit from 'lodash/omit';

import withApi from 'app/utils/withApi';
import withGlobalSelection from 'app/utils/withGlobalSelection';
import {Client} from 'app/api';
import {GlobalSelection, Organization} from 'app/types';
import EventsRequest from 'app/views/events/utils/eventsRequest';
import AreaChart from 'app/components/charts/areaChart';
import {getInterval} from 'app/components/charts/utils';

import EventView from './eventView';

type Props = {
  organization: Organization;
  eventView: EventView;
  api: Client;
  selection: GlobalSelection;
  query: string;
};

const omitProps = (props: Props) => {
  return omit(props, ['api']);
};

class MiniGraph extends React.Component<Props> {
  shouldComponentUpdate(nextProps) {
    // We pay for the cost of the deep comparison here since it is cheaper
    // than the cost for rendering the graph, which can take ~200ms to ~300ms to
    // render.

    return !isEqual(omitProps(this.props), omitProps(nextProps));
  }

  render() {
    const {organization, api, selection, query} = this.props;
    const {start, end, period} = selection.datetime;

    return (
      <EventsRequest
        organization={organization}
        api={api}
        query={query}
        start={start}
        end={end}
        period={period}
        interval={getInterval({start, end, period}, true)}
        project={selection.projects || []}
        environment={selection.environments || []}
      >
        {({loading, timeseriesData}) => {
          if (loading) {
            return null;
          }

          const data = (timeseriesData || []).map(series => {
            return {
              ...series,
              areaStyle: {
                opacity: 0.4,
              },
              lineStyle: {
                opacity: 0,
              },
              smooth: true,
            };
          });

          return (
            <AreaChart
              height={100}
              series={[...data]}
              xAxis={{
                show: false,
                axisPointer: {
                  show: false,
                },
              }}
              yAxis={{
                show: false,
              }}
              tooltip={{
                show: false,
              }}
              toolBox={{
                show: false,
              }}
              grid={{
                left: 0,
                top: 0,
                right: 0,
                bottom: 0,
                containLabel: false,
              }}
              colors={['#6d5fc7']}
              options={{
                hoverAnimation: false,
              }}
            />
          );
        }}
      </EventsRequest>
    );
  }
}

export default withApi(withGlobalSelection(MiniGraph));
