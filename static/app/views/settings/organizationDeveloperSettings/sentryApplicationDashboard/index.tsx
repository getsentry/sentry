import {Fragment} from 'react';
import styled from '@emotion/styled';

import {BarChart} from 'sentry/components/charts/barChart';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {DateTime} from 'sentry/components/dateTime';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelFooter from 'sentry/components/panels/panelFooter';
import PanelHeader from 'sentry/components/panels/panelHeader';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SentryApp} from 'sentry/types/integrations';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';

import RequestLog from './requestLog';

type Interactions = {
  componentInteractions: {
    [key: string]: [number, number][];
  };
  views: [number, number][];
};

type Stats = {
  installStats: [number, number][];
  totalInstalls: number;
  totalUninstalls: number;
  uninstallStats: [number, number][];
};

function SentryApplicationDashboard() {
  const organization = useOrganization();
  const {appSlug} = useParams<{appSlug: string}>();

  // Default time range for now: 90 days ago to now
  const now = Math.floor(new Date().getTime() / 1000);
  const ninety_days_ago = 3600 * 24 * 90;

  const {
    data: app,
    isPending: isAppPending,
    isError: isAppError,
  } = useApiQuery<SentryApp>([`/sentry-apps/${appSlug}/`], {staleTime: 0});

  const {
    data: interactions,
    isPending: isInteractionsPending,
    isError: isInteractionsError,
  } = useApiQuery<Interactions>(
    [
      `/sentry-apps/${appSlug}/interaction/`,
      {query: {since: now - ninety_days_ago, until: now}},
    ],
    {staleTime: 0}
  );

  const {
    data: stats,
    isPending: isStatsPending,
    isError: isStatsError,
  } = useApiQuery<Stats>(
    [
      `/sentry-apps/${appSlug}/stats/`,
      {query: {since: now - ninety_days_ago, until: now}},
    ],
    {staleTime: 0}
  );

  if (isAppPending || isStatsPending || isInteractionsPending) {
    return <LoadingIndicator />;
  }

  if (isAppError || isStatsError || isInteractionsError) {
    return <LoadingError />;
  }

  const {installStats, uninstallStats, totalUninstalls, totalInstalls} = stats;
  const {views, componentInteractions} = interactions;

  const renderInstallData = () => {
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
        {renderInstallCharts()}
      </Fragment>
    );
  };

  const renderInstallCharts = () => {
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
  };

  const renderIntegrationViews = () => {
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
  };

  const renderComponentInteractions = () => {
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
                componentInteractionsDetails[
                  component as keyof typeof componentInteractionsDetails
                ] && (
                  <Fragment key={idx}>
                    <strong>{`${component}: `}</strong>
                    {
                      componentInteractionsDetails[
                        component as keyof typeof componentInteractionsDetails
                      ]
                    }
                    <br />
                  </Fragment>
                )
            )}
          </StyledFooter>
        </PanelFooter>
      </Panel>
    );
  };

  return (
    <div>
      <SentryDocumentTitle title={t('Integration Dashboard')} />
      <SettingsPageHeader title={`${t('Integration Dashboard')} - ${app.name}`} />
      {app.status === 'published' && renderInstallData()}
      {app.status === 'published' && renderIntegrationViews()}
      {app.schema.elements && renderComponentInteractions()}
      <RequestLog app={app} />
    </div>
  );
}

export default SentryApplicationDashboard;

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
