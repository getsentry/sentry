import React from 'react';
import styled from 'react-emotion';

import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import LineChart from 'app/components/charts/lineChart';

import {
  Panel,
  PanelBody,
  PanelHeader,
  PanelFooter,
  PanelItem,
} from 'app/components/panels';
import DateTime from 'app/components/dateTime';
import EmptyMessage from 'app/views/settings/components/emptyMessage';

import space from 'app/styles/space';
import {intcomma} from 'app/utils';
import {t, tn} from 'app/locale';
import {SentryApp} from 'app/types';

type Props = AsyncView['props'];

type State = AsyncView['state'] & {
  stats: any;
  errors: any;
  interactions: any;
  app: SentryApp | null;
};

export default class SentryApplicationDashboard extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      stats: {},
      errors: [],
      interactions: {},
      app: null,
    };
  }

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

  renderTooltip(point, _pointIdx, chart) {
    const timeLabel = chart.getTimeLabel(point);
    const [installed, uninstalled] = point.y;

    return (
      <div style={{width: '150px'}}>
        <div className="time-label">{timeLabel}</div>
        <div className="value-label">
          {intcomma(installed)} {tn('install', 'installs', installed)}
          {uninstalled > 0 && (
            <React.Fragment>
              <br />
              {intcomma(uninstalled)} {tn('uninstall', 'uninstalls', uninstalled)}
            </React.Fragment>
          )}
        </div>
      </div>
    );
  }

  renderInstallCharts() {
    const {install_stats, uninstall_stats} = this.state.stats;
    const points = install_stats.map((point, idx) => ({
      x: point[0],
      y: [point[1], uninstall_stats[idx][1]],
    }));

    return (
      <Panel>
        <PanelHeader>{t('Installations/Uninstallations over Time')}</PanelHeader>

        <StackedBarChart
          points={points}
          height={150}
          className="standard-barchart b-a-0 m-b-0"
          barClasses={['accepted', 'rate-limited']}
          minHeights={[2, 0, 0]}
          gap={0.25}
          tooltip={this.renderTooltip}
        />
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
    [key: string]: number[];
  };
};
const InteractionsChart = ({data}: InteractionsChartProps) => {
  const elementInteractionsSeries = Object.keys(data).map((elementType: string) => {
    const seriesData = data[elementType].map(point => ({
      value: point[1],
      name: point[0] * 1000,
    }));
    return {
      seriesName: elementType,
      data: seriesData,
    };
  });

  return (
    <LineChart
      isGroupedByDate
      series={elementInteractionsSeries}
      grid={{
        left: '30px',
        right: '30px',
      }}
    />
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
