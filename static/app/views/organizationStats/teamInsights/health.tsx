import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {TeamWithProjects} from 'sentry/types';
import localStorage from 'sentry/utils/localStorage';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import useOrganization from 'sentry/utils/useOrganization';
import useTeams from 'sentry/utils/useTeams';

import Header from '../header';

import TeamStatsControls from './controls';
import DescriptionCard from './descriptionCard';
import TeamAlertsTriggered from './teamAlertsTriggered';
import TeamMisery from './teamMisery';
import TeamReleases from './teamReleases';
import TeamStability from './teamStability';
import {dataDatetime} from './utils';

type Props = RouteComponentProps<{orgId: string}, {}>;

function TeamStatsHealth({location, router}: Props) {
  const organization = useOrganization();
  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

  useRouteAnalyticsEventNames('team_insights.viewed', 'Team Insights: Viewed');

  const query = location?.query ?? {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;

  let localTeamId: string | null | undefined =
    query.team ?? localStorage.getItem(localStorageKey);
  if (localTeamId && !teams.find(team => team.id === localTeamId)) {
    localTeamId = null;
  }
  const currentTeamId = localTeamId ?? teams[0]?.id;
  const currentTeam = teams.find(team => team.id === currentTeamId) as
    | TeamWithProjects
    | undefined;
  const projects = currentTeam?.projects ?? [];

  const {period, start, end, utc} = dataDatetime(query);

  if (teams.length === 0) {
    return (
      <NoProjectMessage organization={organization} superuserNeedsToBeProjectMember />
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Project Health')} orgSlug={organization.slug} />
      <Header organization={organization} activeTab="health" />

      <Body>
        <TeamStatsControls
          location={location}
          router={router}
          currentTeam={currentTeam}
        />

        {!initiallyLoaded && <LoadingIndicator />}
        {initiallyLoaded && (
          <Layout.Main fullWidth>
            <DescriptionCard
              title={t('Crash Free Sessions')}
              description={t(
                'The percentage of healthy, errored, and abnormal sessions that didn’t cause a crash.'
              )}
            >
              <TeamStability
                projects={projects}
                organization={organization}
                period={period}
                start={start}
                end={end}
                utc={utc}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('User Misery')}
              description={t(
                'The number of unique users that experienced load times 4x the project’s configured threshold.'
              )}
            >
              <TeamMisery
                organization={organization}
                projects={projects}
                teamId={currentTeam!.id}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                location={location}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('Metric Alerts Triggered')}
              description={t('Alerts triggered from the Alert Rules your team created.')}
            >
              <TeamAlertsTriggered
                organization={organization}
                projects={projects}
                teamSlug={currentTeam!.slug}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                location={location}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('Number of Releases')}
              description={t('The releases that were created in your team’s projects.')}
            >
              <TeamReleases
                projects={projects}
                organization={organization}
                teamSlug={currentTeam!.slug}
                period={period}
                start={start}
                end={end}
                utc={utc}
              />
            </DescriptionCard>
          </Layout.Main>
        )}
      </Body>
    </Fragment>
  );
}

export default TeamStatsHealth;

const Body = styled(Layout.Body)`
  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    display: block;
  }
`;
