import React from 'react';
import {Location} from 'history';

import {Client} from 'app/api';
import EventsRequest from 'app/components/charts/eventsRequest';
import Link from 'app/components/links/link';
import LoadingIndicator from 'app/components/loadingIndicator';
import AreaChart from 'app/components/charts/areaChart';
import {getInterval} from 'app/components/charts/utils';
import EventView from 'app/utils/discover/eventView';
import {NewQuery, Organization} from 'app/types';
import {IconWarning} from 'app/icons';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Card from './index';
import {
  CardHeader,
  CardContent,
  CardTitle,
  CardDetail,
  CardBody,
  CardFooter,
  GraphContainer,
  DateSelected,
} from '../styles';

type Props = Card['props'] & {
  api: Client;
  location: Location;
  organization: Organization;
};

class CardDiscover extends React.Component<Props> {
  renderHeader() {
    const {data} = this.props;
    const {name = null, query = null} = data ?? {};

    if (name === null || query === null) {
      return null;
    }

    return (
      <CardHeader>
        <CardContent>
          <CardTitle>{name}</CardTitle>
          <CardDetail>{query}</CardDetail>
        </CardContent>
      </CardHeader>
    );
  }

  renderBody() {
    const {api, organization, data} = this.props;
    const {query = null, range = null, projects = null} = data ?? {};

    if (query === null || range === null || projects === null) {
      return null;
    }

    const colors = theme.charts.getColorPalette(1);

    return (
      <CardBody>
        <EventsRequest
          organization={organization}
          api={api}
          query={query}
          start={undefined}
          end={undefined}
          period={range}
          interval={getInterval({period: range}, true)}
          project={projects}
          environment={[] as string[]}
          includePrevious={false}
          yAxis="count()"
        >
          {({loading, timeseriesData, errored}) => {
            if (errored) {
              return (
                <GraphContainer>
                  <IconWarning color="gray500" size="md" />
                </GraphContainer>
              );
            }
            if (loading) {
              return (
                <GraphContainer>
                  <LoadingIndicator mini />
                </GraphContainer>
              );
            }

            if (loading) {
              return (
                <GraphContainer>
                  <LoadingIndicator mini />
                </GraphContainer>
              );
            }

            timeseriesData = (timeseriesData || []).map(series => ({
              ...series,
              areaStyle: {
                color: colors[0],
                opacity: 1,
              },
              lineStyle: {
                opacity: 0,
              },
            }));

            return (
              <AreaChart
                height={100}
                series={[...timeseriesData]}
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
                options={{
                  hoverAnimation: false,
                }}
              />
            );
          }}
        </EventsRequest>
      </CardBody>
    );
  }

  renderFooter() {
    const {data} = this.props;
    const {range = null} = data;
    if (range === null) {
      return null;
    }

    const subtitle = `Last ${range}`;
    return (
      <CardFooter>
        <DateSelected>{subtitle}</DateSelected>
      </CardFooter>
    );
  }

  render() {
    const {data, location, organization} = this.props;
    const eventView = EventView.fromNewQueryWithLocation(data as NewQuery, location);
    const to = eventView.getResultsViewUrlTarget(organization.slug);
    return (
      <Link to={to}>
        <Card {...this.props} columnSpan={1} isRemovable={false}>
          {this.renderHeader()}
          {this.renderBody()}
          {this.renderFooter()}
        </Card>
      </Link>
    );
  }
}

export default withApi(withOrganization(CardDiscover));
