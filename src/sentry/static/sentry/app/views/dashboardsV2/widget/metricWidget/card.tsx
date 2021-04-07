import React from 'react';
import {InjectedRouter} from 'react-router/lib/Router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Client} from 'app/api';
import {
  ChartContainer,
  ChartControls,
  InlineContainer,
  SectionHeading,
  SectionValue,
} from 'app/components/charts/styles';
import TransitionChart from 'app/components/charts/transitionChart';
import TransparentLoadingMask from 'app/components/charts/transparentLoadingMask';
import {Panel} from 'app/components/panels';
import {t} from 'app/locale';
import {GlobalSelection, Organization, Project} from 'app/types';
import {YAxis} from 'app/views/releases/detail/overview/chart/releaseChartControls';

import Chart from './chart';
import StatsRequest from './statsRequest';
import {MetricWidget} from './types';

type Props = {
  widget: MetricWidget;
  api: Client;
  location: Location;
  organization: Organization;
  selection: GlobalSelection;
  router: InjectedRouter;
  project: Project;
};

function Card({widget, api, location, router, organization, project, selection}: Props) {
  const {yAxis, queries, title} = widget;

  function getSummaryHeading() {
    switch (yAxis) {
      case YAxis.USERS:
        return t('Total Active Users');
      case YAxis.SESSION_DURATION:
        return t('Median Duration');
      case YAxis.SESSIONS:
      default:
        return t('Total Sessions');
    }
  }

  return (
    <StatsRequest
      api={api}
      location={location}
      organization={organization}
      projectId={project.id}
      yAxis={yAxis}
      queries={queries}
      environments={selection.environments}
      datetime={selection.datetime}
    >
      {({isLoading, errored, data}) => {
        return (
          <StyledPanel>
            <ChartContainer>
              <TransitionChart loading={isLoading} reloading={isLoading}>
                <TransparentLoadingMask visible={isLoading} />
                <Chart
                  platform={project.platform ?? 'other'}
                  isLoading={isLoading}
                  errored={errored}
                  chartData={data[0]?.chartData ?? []}
                  selection={selection}
                  yAxis={yAxis}
                  router={router}
                  title={title}
                />
              </TransitionChart>
            </ChartContainer>
            <ChartControls>
              <InlineContainer>
                <SectionHeading>{getSummaryHeading()}</SectionHeading>
                <SectionValue>{data[0]?.chartSummary}</SectionValue>
              </InlineContainer>
            </ChartControls>
          </StyledPanel>
        );
      }}
    </StatsRequest>
  );
}

export default Card;

const StyledPanel = styled(Panel)`
  margin: 0;
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
`;
