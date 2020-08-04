import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Organization} from 'app/types';
import EventsRequest from 'app/components/charts/eventsRequest';
import LineChart from 'app/components/charts/lineChart';
import LoadingIndicator from 'app/components/loadingIndicator';
import LoadingContainer from 'app/components/loading/loadingContainer';
import {IconFire, IconLaptop, IconLightning, IconWarning} from 'app/icons';
import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {formatFloat, formatPercentage} from 'app/utils/formatters';
import theme from 'app/utils/theme';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';

import Card from './index';

type Props = Card['props'] & {
  api: Client;
  organization: Organization;
};

class CardPerformance extends React.Component<Props> {
  renderHeader() {
    const {data} = this.props;
    const {transaction = null} = data ?? {};

    if (transaction === null) {
      return null;
    }

    return (
      <CardHeader>
        <CardContent>
          <CardTitle>{transaction}</CardTitle>
          <CardDetail>put project here somehow</CardDetail>
        </CardContent>
      </CardHeader>
    );
  }

  renderBody() {
    const {api, organization, data} = this.props;
    const {transaction = null, projectId = null} = data ?? {};

    if (transaction === null || projectId === null || !organization) {
      return null;
    }

    const colors = theme.charts.getColorPalette(1);

    return (
      <CardBody>
        <EventsRequest
          organization={organization}
          api={api}
          query={`transaction:${transaction}`}
          start={undefined}
          end={undefined}
          period="24h"
          interval="60m"
          project={[projectId]}
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

            timeseriesData = (timeseriesData || []).map(series => ({
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
    const {apdex = null, userMisery = null} = data ?? {};

    if (apdex === null || userMisery === null) {
      return null;
    }

    return (
      <CardFooter>
        <span>
          <IconLightning size="xs" /> {formatFloat(apdex, 2)}
        </span>
        <span>
          <IconFire size="xs" /> {formatPercentage(userMisery)}
        </span>
        <span>
          <IconLaptop size="xs" /> 3/4
        </span>
      </CardFooter>
    );
  }

  render() {
    return (
      <Card {...this.props} columnSpan={1} isRemovable={false}>
        {this.renderHeader()}
        {this.renderBody()}
        {this.renderFooter()}
      </Card>
    );
  }
}

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

export default withApi(withOrganization(CardPerformance));
