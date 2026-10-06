import {useMemo} from 'react';
import {useQueries, useQuery} from '@tanstack/react-query';
import {PlatformIcon} from 'platformicons';

import {Tag} from '@sentry/scraps/badge';
import {LinkButton} from '@sentry/scraps/button';
import {Container, Flex, Grid, Stack} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import Feature from 'sentry/components/acl/feature';
import {ErrorBoundary} from 'sentry/components/errorBoundary';
import * as Layout from 'sentry/components/layouts/thirds';
import {NoProjectMessage} from 'sentry/components/noProjectMessage';
import {Placeholder} from 'sentry/components/placeholder';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {
  IconAdd,
  IconClock,
  IconFire,
  IconLightning,
  IconList,
  IconProject,
  IconSpan,
  IconStar,
  IconUser,
  IconWarning,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {
  dashboardDetailsApiOptions,
  dashboardsApiOptions,
} from 'sentry/utils/dashboards/dashboardsApiOptions';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {useUser} from 'sentry/utils/useUser';
import {
  buildLandingSections,
  DATA_SOURCE_LABELS,
  toLandingDashboard,
  type LandingSection,
} from 'sentry/views/dashboards/landing/utils';
import type {WidgetType} from 'sentry/views/dashboards/types';

// The list endpoint has no widget-level data, so custom dashboards need a
// details request to learn which datasets they query. Keep the fan-out bounded.
const MAX_DETAILS_REQUESTS = 25;

const SECTION_ICONS: Record<string, React.ReactNode> = {
  starred: <IconStar isSolid variant="warning" />,
  recommended: <IconLightning variant="accent" />,
  'most-popular': <IconFire variant="danger" />,
  'most-starred': <IconStar variant="warning" />,
  'recently-viewed': <IconClock variant="muted" />,
  errors: <IconWarning variant="danger" />,
  spans: <IconSpan variant="accent" />,
  'logs-metrics': <IconList variant="muted" />,
  'your-projects': <IconProject variant="muted" />,
  'created-by-you': <IconUser variant="muted" />,
};

function SectionBox({section}: {section: LandingSection}) {
  const organization = useOrganization();

  const icon = section.platform ? (
    <PlatformIcon platform={section.platform} size={16} alt="" />
  ) : (
    SECTION_ICONS[section.key]
  );

  return (
    <Container
      border="primary"
      radius="md"
      padding="lg"
      background="primary"
      data-test-id={`landing-section-${section.key}`}
    >
      <Stack gap="md" height="100%">
        <Stack gap="xs">
          <Flex align="center" gap="sm">
            {icon}
            <Heading as="h3" size="md">
              {section.title}
            </Heading>
            {section.isDemoData && <Tag variant="muted">{t('Demo data')}</Tag>}
          </Flex>
          <Text size="sm" variant="muted">
            {section.description}
          </Text>
        </Stack>

        <Stack gap="sm" flex={1}>
          {section.items.length === 0 ? (
            <Text size="sm" variant="muted" italic>
              {section.emptyMessage ?? t('Nothing here yet')}
            </Text>
          ) : (
            section.items.map(({dashboard, reason}) => {
              const sources = Array.from(
                dashboard.dataSources,
                source => DATA_SOURCE_LABELS[source]
              ).join(' · ');
              const detail = reason ?? sources;
              return (
                <Flex
                  key={dashboard.id}
                  align="center"
                  justify="between"
                  gap="md"
                  minWidth="0"
                >
                  <Flex align="center" gap="xs" minWidth="0">
                    <Link
                      to={`/organizations/${organization.slug}/dashboard/${dashboard.id}/`}
                    >
                      <Text ellipsis>{dashboard.title}</Text>
                    </Link>
                    {dashboard.isFavorited && section.key !== 'starred' && (
                      <IconStar isSolid size="xs" variant="warning" />
                    )}
                  </Flex>
                  {detail && (
                    <Text size="xs" variant="muted" wrap="nowrap">
                      {detail}
                    </Text>
                  )}
                </Flex>
              );
            })
          )}
        </Stack>

        {section.viewAllQuery && (
          <Link
            to={{
              pathname: `/organizations/${organization.slug}/dashboards/`,
              query: section.viewAllQuery,
            }}
          >
            <Text size="sm">{t('View all')}</Text>
          </Link>
        )}
      </Stack>
    </Container>
  );
}

function DashboardsLanding() {
  const organization = useOrganization();
  const user = useUser();
  const {projects, fetching: isFetchingProjects} = useProjects();

  const {data: allDashboards, isPending: isPendingAll} = useQuery(
    dashboardsApiOptions(organization, {query: {per_page: 100, sort: 'title'}})
  );
  const {data: mostPopular, isPending: isPendingPopular} = useQuery(
    dashboardsApiOptions(organization, {query: {per_page: 5, sort: 'mostPopular'}})
  );
  const {data: recentlyViewed, isPending: isPendingRecent} = useQuery(
    dashboardsApiOptions(organization, {query: {per_page: 5, sort: 'recentlyViewed'}})
  );

  const customDashboardIds = useMemo(
    () =>
      (allDashboards ?? [])
        .filter(dashboard => !dashboard.prebuiltId)
        .slice(0, MAX_DETAILS_REQUESTS)
        .map(dashboard => dashboard.id),
    [allDashboards]
  );

  const widgetTypesById = useQueries({
    queries: customDashboardIds.map(id => dashboardDetailsApiOptions(organization, id)),
    combine: results => {
      const byId: Record<string, Array<WidgetType | undefined>> = {};
      for (const result of results) {
        if (result.data) {
          byId[result.data.id] = result.data.widgets.map(widget => widget.widgetType);
        }
      }
      return byId;
    },
  });

  const sections = useMemo(() => {
    const toLanding = (dashboard: NonNullable<typeof allDashboards>[number]) =>
      toLandingDashboard(dashboard, widgetTypesById[dashboard.id]);
    return buildLandingSections({
      dashboards: (allDashboards ?? []).map(toLanding),
      mostPopular: (mostPopular ?? []).map(toLanding),
      recentlyViewed: (recentlyViewed ?? []).map(toLanding),
      projects,
      userId: user.id,
    });
  }, [allDashboards, mostPopular, recentlyViewed, projects, user.id, widgetTypesById]);

  const isLoading =
    isPendingAll || isPendingPopular || isPendingRecent || isFetchingProjects;

  return (
    <SentryDocumentTitle title={t('Browse Dashboards')} orgSlug={organization.slug}>
      <ErrorBoundary>
        <Stack flex={1}>
          <NoProjectMessage organization={organization}>
            <Layout.Title>{t('Browse Dashboards')}</Layout.Title>
            <Layout.Body>
              <Layout.Main width="full">
                <Stack gap="xl">
                  <Flex justify="between" align="center" gap="md" wrap="wrap">
                    <Text variant="muted">
                      {t(
                        'A quick tour of the dashboards in %s, tailored to your projects and teammates.',
                        organization.name
                      )}
                    </Text>
                    <Flex gap="md">
                      <LinkButton to={`/organizations/${organization.slug}/dashboards/`}>
                        {t('All Dashboards')}
                      </LinkButton>
                      <Feature features="dashboards-edit">
                        <LinkButton
                          variant="primary"
                          icon={<IconAdd />}
                          to={`/organizations/${organization.slug}/dashboards/new/`}
                        >
                          {t('Create Dashboard')}
                        </LinkButton>
                      </Feature>
                    </Flex>
                  </Flex>
                  <Grid columns={{xs: '1fr', md: '1fr 1fr', xl: '1fr 1fr 1fr'}} gap="lg">
                    {isLoading
                      ? Array.from({length: 9}, (_, index) => (
                          <Placeholder key={index} height="180px" />
                        ))
                      : sections.map(section => (
                          <SectionBox key={section.key} section={section} />
                        ))}
                  </Grid>
                </Stack>
              </Layout.Main>
            </Layout.Body>
          </NoProjectMessage>
        </Stack>
      </ErrorBoundary>
    </SentryDocumentTitle>
  );
}

export default DashboardsLanding;
