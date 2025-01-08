import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {DateTime} from 'sentry/components/dateTime';
import DeprecatedAsyncComponent from 'sentry/components/deprecatedAsyncComponent';
import Link from 'sentry/components/links/link';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SentryApp} from 'sentry/types/integrations';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import RequestLog from './requestLog';

type Props = RouteComponentProps<{appSlug: string}, {}> & {
  organization: Organization;
};

type State = DeprecatedAsyncComponent['state'] & {
  app: SentryApp;
  interactions: {
    componentInteractions: {
      [key: string]: [number, number][];
    };
    views: [number, number][];
  };
  stats: {
    installStats: [number, number][];
    totalInstalls: number;
    totalUninstalls: number;
    uninstallStats: [number, number][];
  };
};

class SentryApplicationDashboard extends DeprecatedAsyncComponent<Props, State> {
  getEndpoints(): ReturnType<DeprecatedAsyncComponent['getEndpoints']> {
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

      [
        'interactions',
        `/sentry-apps/${appSlug}/interaction/`,
        {query: {since: now - ninety_days_ago, until: now}},
      ],
      ['app', `/sentry-apps/${appSlug}/`],
    ];
  }

  renderInstallData() {
    const {app, stats} = this.state;
    const {totalUninstalls, totalInstalls} = stats;
    return (
      <Fragment>
        <h5>{t('Installation & Interaction Data')}</h5>
        <Row>
          {app.datePublished ? (
            <StatsSection>
              <StatsHeader>{t('Date published')}</StatsHeader>
              <DateTime dateOnly date={app.datePublished} />
            </StatsSection>
          ) : null}
          <StatsSection data-test-id="installs">
            <StatsHeader>{t('Total installs')}</StatsHeader>
            <p>{totalInstalls}</p>
          </StatsSection>
          <StatsSection data-test-id="uninstalls">
            <StatsHeader>{t('Total uninstalls')}</StatsHeader>
            <p>{totalUninstalls}</p>
          </StatsSection>
        </Row>
        {this.renderInstallCharts()}
      </Fragment>
    );
  }

  renderInstallCharts() {
    const {installStats, uninstallStats} = this.state.stats;

    const installSeries = {
      data: installStats.map(point => ({
        name: point[0] * 1000,
        value: point[1],
      })),
      seriesName: t('installed'),
    };
    const uninstallSeries = {
      data: uninstallStats.map(point => ({
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

  renderIntegrationViews() {
    const {views} = this.state.interactions;
    const {organization} = this.props;
    const {appSlug} = this.props.params;

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
            <Link to={`/settings/${organization.slug}/integrations/`}>
              {t('integrations page')}
            </Link>
          </StyledFooter>
        </PanelFooter>
      </Panel>
    );
  }

  renderComponentInteractions() {
    const {componentInteractions} = this.state.interactions;
    const componentInteractionsDetails = {
      'stacktrace-link': t(
        'Each link click or context menu open counts as one interaction'
      ),
      'issue-link': t('Each open of the issue link modal counts as one interaction'),
    };

    return (
      <Panel>
        <PanelHeader>{t('Component Interactions')}</PanelHeader>

        <PanelBody>
          <InteractionsChart data={componentInteractions} />
        </PanelBody>

        <PanelFooter>
          <StyledFooter>
            {Object.keys(componentInteractions).map(
              (component, idx) =>
                componentInteractionsDetails[component] && (
                  <Fragment key={idx}>
                    <strong>{`${component}: `}</strong>
                    {componentInteractionsDetails[component]}
                    <br />
                  </Fragment>
                )
            )}
          </StyledFooter>
        </PanelFooter>
      </Panel>
    );
  }

  renderBody() {
    const {app} = this.state;

    return (
      <div>
        <SentryDocumentTitle title={t('Integration Dashboard')} />
        <SettingsPageHeader title={`${t('Integration Dashboard')} - ${app.name}`} />
        {app.status === 'published' && this.renderInstallData()}
        {app.status === 'published' && this.renderIntegrationViews()}
        {app.schema.elements && this.renderComponentInteractions()}
        <RequestLog app={app} />
      </div>
    );
  }
}

export default withOrganization(SentryApplicationDashboard);

type InteractionsChartProps = {
  data: {
    [key: string]: [number, number][];
  };
};
function InteractionsChart({data}: InteractionsChartProps) {
  const elementInteractionsSeries: LineChartSeries[] = Object.keys(data).map(
    (key: string) => {
      const seriesData = data[key]!.map(point => ({
        value: point[1],
        name: point[0] * 1000,
      }));
      return {
        seriesName: key,
        data: seriesData,
      };
    }
  );

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
}

const Row = styled('div')`
  display: flex;
`;

const StatsSection = styled('div')`
  margin-right: ${space(4)};
`;
const StatsHeader = styled('h6')`
  margin-bottom: ${space(1)};
  font-size: 12px;
  text-transform: uppercase;
  color: ${p => p.theme.subText};
`;

const StyledFooter = styled('div')`
  padding: ${space(1.5)};
`;

const ChartWrapper = styled('div')`
  padding-top: ${space(3)};
`;
