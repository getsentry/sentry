import React from 'react';
import styled from 'react-emotion';

import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import LineChart from 'app/components/charts/lineChart';

import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelFooter,
  PanelItem,
} from 'app/components/panels';
import BarChart from 'app/components/charts/barChart';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';
import Link from 'app/components/links/link';

import space from 'app/styles/space';
import {SentryApp, SentryAppWebhookRequest} from 'app/types';
import {t} from 'app/locale';

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  stats: {
    total_uninstalls: number;
    total_installs: number;
    install_stats: [number, number][];
    uninstall_stats: [number, number][];
  };
  requests: SentryAppWebhookRequest[];
  interactions: {
    component_interactions: {
      [key: string]: [number, number][];
    };
    views: [number, number][];
  };
  app: SentryApp;
};

export default class SentryApplicationDashboard extends AsyncView<Props, State> {
  getEndpoints(): Array<[string, string, any] | [string, string]> {
    const {appSlug} = this.props.params;
    // Default time range for now: 90 days ago to now
    const now = Math.floor(new Date().getTime() / 1000);
    const ninety_days_ago = 3600 * 24 * 90;
    return [
      [
        'stats',
        `/sentry-apps/${appSlug}/stats/`,
        {query: {since: now - ninety_days_ago, until: now}},
      ],
      ['requests', `/sentry-apps/${appSlug}/requests/`],
      [
        'interactions',
        `/sentry-apps/${appSlug}/interaction/`,
        {query: {since: now - ninety_days_ago, until: now}},
      ],
      ['app', `/sentry-apps/${appSlug}/`],
    ];
  }

  getTitle() {
    return t('Integration Dashboard');
  }

  renderInstallData() {
    const {total_uninstalls, total_installs} = this.state.stats;
    return (
      <React.Fragment>
        <h5>{t('Installation Data')}</h5>
        <Row>
          <StatsSection>
            <StatsHeader>{t('Total installs')}</StatsHeader>
            <p>{total_installs}</p>
          </StatsSection>
          <StatsSection>
            <StatsHeader>{t('Total uninstalls')}</StatsHeader>
            <p>{total_uninstalls}</p>
          </StatsSection>
        </Row>
        {this.renderInstallCharts()}
      </React.Fragment>
    );
  }

  renderInstallCharts() {
    const {install_stats, uninstall_stats} = this.state.stats;

    const installSeries = {
      data: install_stats.map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
      seriesName: t('installed'),
    };
    const uninstallSeries = {
      data: uninstall_stats.map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
      seriesName: t('uninstalled'),
    };

    return (
      <Panel>
        <PanelHeader>{t('Installations/Uninstallations over Last 90 Days')}</PanelHeader>
        <ChartWrapper>
          <BarChart
            series={[installSeries, uninstallSeries]}
            height={150}
            stacked
            isGroupedByDate
            legend={{
              show: true,
              orient: 'horizontal',
              data: ['installed', 'uninstalled'],
              itemWidth: 15,
            }}
            yAxis={{type: 'value', minInterval: 1, max: 'dataMax'}}
            xAxis={{type: 'time'}}
            grid={{left: space(4), right: space(4)}}
          />
        </ChartWrapper>
      </Panel>
    );
  }

  renderRequestLog() {
    const {requests, app} = this.state;
    return (
      <React.Fragment>
        <h5>{t('Request Log')}</h5>
        <p>
          {t(
            'This log shows outgoing webhook requests for the following events: issue.assigned, issue.ignored, issue.resolved, issue.created, error.created'
          )}
        </p>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Time')}</div>
              <div>{t('Status Code')}</div>
              {app.status !== 'internal' && <div>{t('Organization')}</div>}
              <div>{t('Event Type')}</div>
              <div>{t('Webhook URL')}</div>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {requests.length > 0 ? (
              requests.map((request, idx) => (
                <PanelItem key={idx}>
                  <TableLayout>
                    <DateTime date={request.date} />
                    <div>{request.responseCode}</div>
                    {app.status !== 'internal' && request.organization && (
                      <div>{request.organization.name}</div>
                    )}
                    <div>{request.eventType}</div>
                    <OverflowBox>{request.webhookUrl}</OverflowBox>
                  </TableLayout>
                </PanelItem>
              ))
            ) : (
              <EmptyMessage icon="icon-circle-exclamation">
                {t('No requests found.')}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }

  renderIntegrationViews() {
    const {views} = this.state.interactions;
    const {appSlug, orgId} = this.props.params;

    return (
      <Panel>
        <PanelHeader>{t('Integration Views')}</PanelHeader>
        <PanelBody>
          <InteractionsChart data={{Views: views}} />
        </PanelBody>

        <PanelFooter>
          <StyledFooter>
            {t('Integration views are measured through views on the ')}
            <Link to={`/sentry-apps/${appSlug}/external-install/`}>
              {t('external installation page')}
            </Link>
            {t(' and views on the Learn More/Install modal on the ')}
            <Link to={`/settings/${orgId}/integrations/`}>{t('integrations page')}</Link>
          </StyledFooter>
        </PanelFooter>
      </Panel>
    );
  }

  renderComponentInteractions() {
    const {component_interactions} = this.state.interactions;

    return (
      <Panel>
        <PanelHeader>{t('Component Interactions')}</PanelHeader>

        <PanelBody>
          <InteractionsChart data={component_interactions} />
        </PanelBody>

        <PanelFooter>
          <StyledFooter>
            <strong>{t('stacktrace-link:')}</strong>{' '}
            {t('Each click on the link counts as one interaction')}
            <br />
            <strong>{t('issue-link:')}</strong>{' '}
            {t('Each open of the issue link modal counts as one interaction')}
          </StyledFooter>
        </PanelFooter>
      </Panel>
    );
  }

  renderBody() {
    const {app} = this.state;

    return (
      <div>
        {<SettingsPageHeader title={app.name} />}
        {app.status === 'published' && this.renderInstallData()}
        {this.renderRequestLog()}
        {app.status === 'published' && this.renderIntegrationViews()}
        {app.schema.elements && this.renderComponentInteractions()}
      </div>
    );
  }
}

type InteractionsChartProps = {
  data: {
    [key: string]: [number, number][];
  };
};
const InteractionsChart = ({data}: InteractionsChartProps) => {
  const elementInteractionsSeries = Object.keys(data).map((key: string) => {
    const seriesData = data[key].map(point => ({
      value: point[1],
      name: point[0] * 1000,
    }));
    return {
      seriesName: key,
      data: seriesData,
    };
  });

  return (
    <ChartWrapper>
      <LineChart
        isGroupedByDate
        series={elementInteractionsSeries}
        grid={{left: space(4), right: space(4)}}
        legend={{
          show: true,
          orient: 'horizontal',
          data: Object.keys(data),
        }}
      />
    </ChartWrapper>
  );
};

const Row = styled('div')`
  display: flex;
`;

const StatsSection = styled('div')`
  margin-right: ${space(2)};
`;
const StatsHeader = styled('h6')`
  margin-bottom: ${space(1)};
  font-size: 12px;
  text-transform: uppercase;
  color: ${p => p.theme.gray3};
`;

const TableLayout = styled('div')`
  display: grid;
  grid-template-columns: 1fr 0.5fr 1fr 1fr 1fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const OverflowBox = styled('div')`
  word-break: break-word;
`;

const StyledFooter = styled('div')`
  padding: ${space(1.5)};
`;

const ChartWrapper = styled('div')`
  padding-top: ${space(3)};
`;
