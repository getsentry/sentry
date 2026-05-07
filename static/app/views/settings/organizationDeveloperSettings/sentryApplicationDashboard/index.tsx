import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';

import {sentryAppApiOptions} from 'sentry/actionCreators/sentryApps';
import {BarChart} from 'sentry/components/charts/barChart';
import type {LineChartSeries} from 'sentry/components/charts/lineChart';
import {LineChart} from 'sentry/components/charts/lineChart';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelBody} from 'sentry/components/panels/panelBody';
import {PanelFooter} from 'sentry/components/panels/panelFooter';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';

import {RequestLog} from './requestLog';

type Interactions = {
  componentInteractions: Record<string, Array<[number, number]>>;
  views: Array<[number, number]>;
};

type Stats = {
  installStats: Array<[number, number]>;
  totalInstalls: number;
  totalUninstalls: number;
  uninstallStats: Array<[number, number]>;
};

function SentryApplicationDashboard() {
  const theme = useTheme();
  const organization = useOrganization();
  const {appSlug} = useParams<{appSlug: string}>();

  // Time range is captured once on mount so the queryKey stays stable across
  // re-renders. Otherwise `now` advances every second and react-query refetches
  // each tick.
  const [timeRange] = useState(() => {
    const now = Math.floor(Date.now() / 1000);
    return {since: now - 3600 * 24 * 90, until: now};
  });

  const {
    data: app,
    isPending: isAppPending,
    isError: isAppError,
  } = useQuery(sentryAppApiOptions({appSlug}));

  // Stats and interactions are only rendered for published apps (or, for
  // component interactions, when the app declares schema elements). Gate the
  // queries so unpublished apps don't fire backend requests for data that's
  // never displayed — those requests can hang and would otherwise leave the
  // whole page stuck on a spinner.
  const showInstallData = app?.status === 'published';
  // Fetch gate: union of the conditions used to render the two panels that
  // consume the interactions response — Integration Views needs `views`
  // (rendered when `showInstallData`), Component Interactions needs
  // `componentInteractions` (rendered when `app.schema.elements`).
  const shouldFetchInteractions =
    app?.status === 'published' || Boolean(app?.schema.elements);

  const {
    data: interactions,
    isLoading: isInteractionsLoading,
    isError: isInteractionsError,
  } = useApiQuery<Interactions>(
    [
      getApiUrl('/sentry-apps/$sentryAppIdOrSlug/interaction/', {
        path: {sentryAppIdOrSlug: appSlug},
      }),
      {query: timeRange},
    ],
    {staleTime: 0, enabled: shouldFetchInteractions}
  );

  const {
    data: stats,
    isLoading: isStatsLoading,
    isError: isStatsError,
  } = useApiQuery<Stats>(
    [
      getApiUrl('/sentry-apps/$sentryAppIdOrSlug/stats/', {
        path: {sentryAppIdOrSlug: appSlug},
      }),
      {query: timeRange},
    ],
    {staleTime: 0, enabled: showInstallData}
  );

  if (isAppPending || isStatsLoading || isInteractionsLoading) {
    return <LoadingIndicator />;
  }

  if (isAppError || isStatsError || isInteractionsError) {
    return <LoadingError />;
  }

  const renderInstallData = (statsData: Stats) => {
    const {installStats, uninstallStats, totalUninstalls, totalInstalls} = statsData;
    return (
      <Fragment>
        <h5>{t('Installation & Interaction Data')}</h5>
        <Flex>
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
        </Flex>
        {renderInstallCharts(installStats, uninstallStats)}
      </Fragment>
    );
  };

  const renderInstallCharts = (
    installStats: Array<[number, number]>,
    uninstallStats: Array<[number, number]>
  ) => {
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
            grid={{left: theme.space['3xl'], right: theme.space['3xl']}}
          />
        </ChartWrapper>
      </Panel>
    );
  };

  const renderIntegrationViews = (interactionsData: Interactions) => {
    return (
      <Panel>
        <PanelHeader>{t('Integration Views')}</PanelHeader>
        <PanelBody>
          <InteractionsChart data={{Views: interactionsData.views}} />
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

  const renderComponentInteractions = (interactionsData: Interactions) => {
    const componentInteractions = interactionsData.componentInteractions;
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
      {stats && renderInstallData(stats)}
      {showInstallData && interactions && renderIntegrationViews(interactions)}
      {app.schema.elements && interactions && renderComponentInteractions(interactions)}
      <RequestLog app={app} />
    </div>
  );
}

export default SentryApplicationDashboard;

type InteractionsChartProps = {
  data: Record<string, Array<[number, number]>>;
};
function InteractionsChart({data}: InteractionsChartProps) {
  const theme = useTheme();
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
        grid={{left: theme.space['3xl'], right: theme.space['3xl']}}
        legend={{
          show: true,
          orient: 'horizontal',
          data: Object.keys(data),
        }}
      />
    </ChartWrapper>
  );
}

const StatsSection = styled('div')`
  margin-right: ${p => p.theme.space['3xl']};
`;
const StatsHeader = styled('h6')`
  margin-bottom: ${p => p.theme.space.md};
  font-size: 12px;
  text-transform: uppercase;
  color: ${p => p.theme.tokens.content.secondary};
`;

const StyledFooter = styled('div')`
  padding: ${p => p.theme.space.lg};
`;

const ChartWrapper = styled('div')`
  padding-top: ${p => p.theme.space['2xl']};
`;
