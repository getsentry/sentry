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

import space from 'app/styles/space';
import {SentryApp, SentryAppWebhookError} from 'app/types';
import {t} from 'app/locale';

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  stats: {
    total_uninstalls: number;
    total_installs: number;
    install_stats: [number, number][];
    uninstall_stats: [number, number][];
  };
  errors: SentryAppWebhookError[];
  interactions: {
    component_interactions: {
      [key: string]: [number, number][];
    };
    views: [number, number][];
  };
  app: SentryApp | null;
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
      ['errors', `/sentry-apps/${appSlug}/errors/`],
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

  renderErrorLog() {
    const {errors} = this.state;
    return (
      <React.Fragment>
        <h5>{t('Error Log')}</h5>
        <p>
          {t(
            'This log shows the errors captured from outgoing webhook requests for the following events: issue.assigned, issue.ignored, issue.resolved'
          )}
        </p>
        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Time')}</div>
              <div>{t('Status Code')}</div>
              <div>{t('Organization')}</div>
              <div>{t('Event Type')}</div>
              <div>{t('Webhook URL')}</div>
              <div>{t('Response Body')}</div>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {errors.length > 0 ? (
              errors.map((error, idx) => (
                <PanelItem key={idx}>
                  <TableLayout>
                    <DateTime date={error.date} />
                    <div>{error.response.statusCode}</div>
                    <div>{error.organization.name}</div>
                    <div>{error.eventType}</div>
                    <OverflowBox>{error.webhookUrl}</OverflowBox>
                    <OverflowBox>{error.response.body}</OverflowBox>
                  </TableLayout>
                </PanelItem>
              ))
            ) : (
              <EmptyMessage icon="icon-circle-exclamation">
                {t('No errors found.')}
              </EmptyMessage>
            )}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }

  renderIntegrationViews() {
    const {views} = this.state.interactions;
    return (
      <Panel>
        <PanelHeader>{t('Integration Views')}</PanelHeader>

        <InteractionsChart data={{Views: views}} />
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
        {app && <SettingsPageHeader title={app.name} />}
        {app && app.status === 'published' && this.renderInstallData()}
        {this.renderErrorLog()}
        {app && app.status === 'published' && this.renderIntegrationViews()}
        {app && app.schema.elements && this.renderComponentInteractions()}
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
  grid-template-columns: 1fr 0.5fr 1fr 1fr 1fr 2fr;
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
