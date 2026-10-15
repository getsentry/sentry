import {Fragment, useState} from 'react';
import {useTheme} from '@emotion/react';
import {useQuery} from '@tanstack/react-query';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {sentryAppApiOptions} from 'sentry/actionCreators/sentryApps';
import {BarChart} from 'sentry/components/charts/barChart';
import {DateTime} from 'sentry/components/dateTime';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Panel} from 'sentry/components/panels/panel';
import {PanelHeader} from 'sentry/components/panels/panelHeader';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {SentryApp} from 'sentry/types/integrations';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {SettingsPageHeader} from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import {RequestLog} from './requestLog';

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
  const canViewRequestLogs =
    organization.access.includes('org:write') ||
    organization.access.includes('org:admin') ||
    isActiveSuperuser();

  return (
    <div>
      <SentryDocumentTitle title={t('Integration Dashboard')} />
      <SettingsPageHeader title={`${t('Integration Dashboard')} - ${app.name}`} />
      {showInstallData ? (
        <InstallDataSection app={app} appSlug={appSlug} timeRange={timeRange} />
      ) : null}
      {canViewRequestLogs ? (
        <RequestLog app={app} />
      ) : (
        <Stack gap="md">
          <Heading as="h5">{t('Request Log')}</Heading>
          <OrganizationPermissionAlert
            access={['org:write', 'org:admin']}
            message={t(
              'You need organization write or admin access to view the request log.'
            )}
          />
        </Stack>
      )}
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
      <h5>{t('Installation Data')}</h5>
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

function StatsHeader({children}: {children: React.ReactNode}) {
  return (
    <Container paddingBottom="md">
      <Text size="xs" variant="muted" uppercase bold>
        {children}
      </Text>
    </Container>
  );
}
