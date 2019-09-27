import React from 'react';
import styled from 'react-emotion';

import AsyncView from 'app/views/asyncView';
import SettingsPageHeader from 'app/views/settings/components/settingsPageHeader';
import StackedBarChart from 'app/components/stackedBarChart';
import {Panel, PanelBody, PanelHeader, PanelItem} from 'app/components/panels';
import DateTime from 'app/components/dateTime';

import overflowEllipsis from 'app/styles/overflowEllipsis';
import space from 'app/styles/space';
import {intcomma} from 'app/utils';
import {t} from 'app/locale';
import {SentryApp} from 'app/types';

type Props = AsyncView['props'] & {
  route: {
    path: string;
  };
};

type State = AsyncView['state'] & {
  stats: any;
  errors: any;
  app: SentryApp | null;
};

export default class SentryApplicationDashboard extends AsyncView<Props, State> {
  getDefaultState(): State {
    return {
      ...super.getDefaultState(),
      stats: {},
      app: null,
    };
  }

  getEndpoints(): Array<[string, string, any] | [string, string]> {
    const {appSlug} = this.props.params;
    if (appSlug) {
      // Default time range for now: 30 days ago to now
      const now = Math.floor(new Date().getTime() / 1000);
      return [
        [
          'stats',
          `/sentry-apps/${appSlug}/stats/`,
          {query: {since: now - 3600 * 24 * 30, until: now}},
        ],
        ['errors', `/sentry-apps/${appSlug}/errors/`],
        ['app', `/sentry-apps/${appSlug}/`],
      ];
    }
    return [];
  }

  getTitle() {
    return t('Sentry Application Dashboard');
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
          {intcomma(installed)} {`install${installed !== 1 ? 's' : ''}`}
          {uninstalled > 0 && (
            <React.Fragment>
              <br />
              {intcomma(uninstalled)} {`uninstall${uninstalled !== 1 ? 's' : ''}`}
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
        <Panel>
          <PanelHeader>
            <TableLayout>
              <div>{t('Time')}</div>
              <div>{t('Organization')}</div>
              <div>{t('Event Type')}</div>
              <div>{t('Webhook URL')}</div>
              <div>{t('Response Body')}</div>
              <div>{t('Status Code')}</div>
            </TableLayout>
          </PanelHeader>

          <PanelBody>
            {errors.map((error, idx) => (
              <PanelItem key={idx}>
                <TableLayout>
                  <DateTime date={error.date} />
                  <div>{error.organization.name}</div>
                  <div>{error.eventType}</div>
                  <OverflowBox>{error.webhookUrl}</OverflowBox>
                  <div>{error.response.body}</div>
                  <div>{error.response.statusCode}</div>
                </TableLayout>
              </PanelItem>
            ))}
          </PanelBody>
        </Panel>
      </React.Fragment>
    );
  }

  renderBody() {
    const {app} = this.state;
    return (
      <div>
        {app && <SettingsPageHeader title={app.name} />}
        {this.renderInstallData()}
        {this.renderErrorLog()}
      </div>
    );
  }
}

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
  grid-template-columns: 1fr 1fr 1fr 1fr 2fr 0.5fr;
  grid-column-gap: ${space(1.5)};
  width: 100%;
  align-items: center;
`;

const OverflowBox = styled('div')`
  ${overflowEllipsis}
`;
