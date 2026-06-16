import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

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
import {t, tct} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
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

type TimeRange = {
  since: number;
  until: number;
};

function sentryAppInteractionsApiOptions({
  appSlug,
  timeRange,
}: {
  appSlug: string;
  timeRange: TimeRange;
}) {
  return apiOptions.as<Interactions>()('/sentry-apps/$sentryAppIdOrSlug/interaction/', {
    path: {sentryAppIdOrSlug: appSlug},
    query: timeRange,
    staleTime: 0,
  });
}

function sentryAppStatsApiOptions({
  appSlug,
  timeRange,
}: {
  appSlug: string;
  timeRange: TimeRange;
}) {
  return apiOptions.as<Stats>()('/sentry-apps/$sentryAppIdOrSlug/stats/', {
    path: {sentryAppIdOrSlug: appSlug},
    query: timeRange,
    staleTime: 0,
  });
}

function SentryApplicationDashboard() {
  const organization = useOrganization();
  const {appSlug} = useParams<{appSlug: string}>();

  // Default time range for now: 90 days ago to now
  const [timeRange] = useState<TimeRange>(() => {
    const now = Math.floor(Date.now() / 1000);
    return {since: now - 3600 * 24 * 90, until: now};
  });

  const {
    data: app,
    isPending: isAppPending,
    isError: isAppError,
  } = useQuery(sentryAppApiOptions({appSlug}));

  if (isAppPending) {
    return <LoadingIndicator />;
  }

  if (isAppError || !app) {
    return <LoadingError />;
  }
  const showInstallData = app.status === 'published';
  const showComponentInteractions = Boolean(app.schema?.elements);

  return (
    <div>
      <SentryDocumentTitle title={t('Integration Dashboard')} />
      <SettingsPageHeader title={`${t('Integration Dashboard')} - ${app.name}`} />
      {showInstallData ? (
        <Fragment>
          <InstallDataSection app={app} appSlug={appSlug} timeRange={timeRange} />
          <IntegrationViewsSection
            appSlug={appSlug}
            organizationSlug={organization.slug}
            timeRange={timeRange}
          />
        </Fragment>
      ) : null}
      {showComponentInteractions ? (
        <ComponentInteractionsSection appSlug={appSlug} timeRange={timeRange} />
      ) : null}
      <RequestLog app={app} />
    </div>
  );
}

export default SentryApplicationDashboard;

type InstallDataSectionProps = {
  app: SentryApp;
  appSlug: string;
  timeRange: TimeRange;
};

function InstallDataSection({app, appSlug, timeRange}: InstallDataSectionProps) {
  const {
    data: stats,
    isPending,
    isError,
  } = useQuery(sentryAppStatsApiOptions({appSlug, timeRange}));

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !stats) {
    return <LoadingError />;
  }

  const {installStats, uninstallStats, totalUninstalls, totalInstalls} = stats;

  return (
    <Fragment>
      <h5>{t('Installation & Interaction Data')}</h5>
      <Flex gap="3xl">
        {app.datePublished ? (
          <Container>
            <StatsHeader>{t('Date published')}</StatsHeader>
            <DateTime dateOnly date={app.datePublished} />
          </Container>
        ) : null}
        <Container data-test-id="installs">
          <StatsHeader>{t('Total installs')}</StatsHeader>
          <p>{totalInstalls}</p>
        </Container>
        <Container data-test-id="uninstalls">
          <StatsHeader>{t('Total uninstalls')}</StatsHeader>
          <p>{totalUninstalls}</p>
        </Container>
      </Flex>
      <InstallCharts installStats={installStats} uninstallStats={uninstallStats} />
    </Fragment>
  );
}

type InstallChartsProps = {
  installStats: Array<[number, number]>;
  uninstallStats: Array<[number, number]>;
};

function InstallCharts({installStats, uninstallStats}: InstallChartsProps) {
  const theme = useTheme();

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
      <Container paddingTop="2xl">
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
      </Container>
    </Panel>
  );
}

type IntegrationViewsSectionProps = {
  appSlug: string;
  organizationSlug: string;
  timeRange: TimeRange;
};

function IntegrationViewsSection({
  appSlug,
  organizationSlug,
  timeRange,
}: IntegrationViewsSectionProps) {
  const {
    data: interactions,
    isPending,
    isError,
  } = useQuery(sentryAppInteractionsApiOptions({appSlug, timeRange}));

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !interactions) {
    return <LoadingError />;
  }

  return (
    <Panel>
      <PanelHeader>{t('Integration Views')}</PanelHeader>
      <PanelBody>
        <InteractionsChart data={{Views: interactions.views}} />
      </PanelBody>
      <PanelFooter>
        <Container padding="lg">
          {tct(
            'Integration views are measured through views on the [externalInstallPage:external installation page] and views on the Learn More/Install modal on the [integrationsPage:integrations page]',
            {
              externalInstallPage: (
                <Link to={`/sentry-apps/${appSlug}/external-install/`} />
              ),
              integrationsPage: (
                <Link to={`/settings/${organizationSlug}/integrations/`} />
              ),
            }
          )}
        </Container>
      </PanelFooter>
    </Panel>
  );
}

type ComponentInteractionsSectionProps = {
  appSlug: string;
  timeRange: TimeRange;
};

function ComponentInteractionsSection({
  appSlug,
  timeRange,
}: ComponentInteractionsSectionProps) {
  const {
    data: interactions,
    isPending,
    isError,
  } = useQuery(sentryAppInteractionsApiOptions({appSlug, timeRange}));

  if (isPending) {
    return <LoadingIndicator />;
  }

  if (isError || !interactions) {
    return <LoadingError />;
  }

  const componentInteractions = interactions.componentInteractions;
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
        <Container padding="lg">
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
        </Container>
      </PanelFooter>
    </Panel>
  );
}

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
    <Container paddingTop="2xl">
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
    </Container>
  );
}

function StatsHeader({children}: {children: React.ReactNode}) {
  return (
    <Container paddingBottom="md">
      <Text size="xs" variant="muted" uppercase bold>
        {children}
      </Text>
    </Container>
  );
}
