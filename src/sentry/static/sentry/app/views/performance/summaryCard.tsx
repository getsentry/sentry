import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import AsyncComponent from 'app/components/asyncComponent';
import Card from 'app/components/card';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {IconFire, IconLaptop, IconLightning, IconWarning} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {formatFloat, formatPercentage} from 'app/utils/formatters';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';

type Props = AsyncComponent['props'] & {
  organization: Organization;
  transactionName: string;
  projectId: number;
  api: Client;
};

type State = AsyncComponent['state'] & {
  event: any;
  stats: {
    data: {
      user_misery_300: number;
      apdex_300: number;
    }[];
  };
};

class SummaryCard extends AsyncComponent<Props, State> {
  getEndpoints(): ReturnType<AsyncComponent['getEndpoints']> {
    const {projectId, organization} = this.props;

    return [
      [
        'event',
        `/organizations/${organization.slug}/eventsv2/`,
        {
          query: {
            statsPeriod: '24h',
            project: [projectId],
            field: ['transaction', 'apdex(300)', 'user_misery(300)'],
            sort: 'transaction',
            per_page: 50,
            query: this.getQuery(),
          },
        },
      ],
    ];
  }

  getQuery() {
    const {transactionName} = this.props;
    return `transaction:${transactionName}`;
  }

  renderGraph() {
    const {api, organization} = this.props;
    const colors = theme.charts.getColorPalette(1);

    return (
      <EventsRequest
        organization={organization}
        api={api}
        query={this.getQuery()}
        start={undefined}
        end={undefined}
        period="24h"
        interval="60m"
        project={[1] as number[]}
        environment={[] as string[]}
        includePrevious={false}
        yAxis="apdex(300)"
      >
        {({loading, timeseriesData, errored}) => {
          if (errored) {
            return (
              <StyledGraphContainer>
                <IconWarning color="gray500" size="md" />
              </StyledGraphContainer>
            );
          }
          if (loading) {
            return (
              <StyledGraphContainer>
                <LoadingIndicator mini />
              </StyledGraphContainer>
            );
          }

          if (loading) {
            return (
              <StyledGraphContainer>
                <LoadingIndicator mini />
              </StyledGraphContainer>
            );
          }

          const data = (timeseriesData || []).map(series => ({
            ...series,
            areaStyle: {
              color: colors[0],
              opacity: 0,
            },
            lineStyle: {
              opacity: 1,
            },
          }));

          return (
            <LineChart
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
              options={{
                hoverAnimation: false,
              }}
            />
          );
        }}
      </EventsRequest>
    );
  }

  renderFooter() {
    const {event} = this.state;
    if (event === null) {
      return null;
    }

    const {apdex_300, user_misery_300} = event.data[0];

    return (
      <CardFooter>
        <span>
          <IconLightning size="xs" /> {formatFloat(apdex_300, 2)}
        </span>
        <span>
          <IconFire size="xs" /> {formatPercentage(user_misery_300)}
        </span>
        <span>
          <IconLaptop size="xs" /> 3/4
        </span>
      </CardFooter>
    );
  }

  render() {
    const {transactionName} = this.props;

    return (
      <StyledCard interactive>
        <CardHeader>
          <CardContent>
            <CardTitle>{transactionName}</CardTitle>
            <CardDetail>qwer</CardDetail>
          </CardContent>
        </CardHeader>
        <CardBody>{this.renderGraph()}</CardBody>
        {this.renderFooter()}
      </StyledCard>
    );
  }
}

const StyledCard = styled(Card)`
  justify-content: space-between;
  height: 100%;
  &:focus,
  &:hover {
    top: -1px;
  }
`;

const CardHeader = styled('div')`
  display: flex;
  padding: ${space(1.5)} ${space(2)};
`;

const CardContent = styled('div')`
  flex-grow: 1;
  overflow: hidden;
  margin-right: ${space(1)};
`;

const CardTitle = styled('div')`
  color: ${p => p.theme.textColor};
  ${overflowEllipsis};
`;

const CardDetail = styled('div')`
  font-family: ${p => p.theme.text.familyMono};
  font-size: ${p => p.theme.fontSizeSmall};
  color: ${p => p.theme.gray500};
  line-height: 1.5;
  ${overflowEllipsis};
`;

const CardBody = styled('div')`
  background: ${p => p.theme.gray200};
  max-height: 100px;
  height: 100%;
  overflow: hidden;
`;

const CardFooter = styled('div')`
  display: flex;
  font-size: ${p => p.theme.fontSizeSmall};
  justify-content: space-between;
  align-items: center;
  padding: ${space(1)} ${space(2)};
`;

const StyledGraphContainer = styled(props => (
  <LoadingContainer {...props} maskBackgroundColor="transparent" />
))`
  height: 100px;

  display: flex;
  justify-content: center;
  align-items: center;
`;

export default withApi(SummaryCard);
