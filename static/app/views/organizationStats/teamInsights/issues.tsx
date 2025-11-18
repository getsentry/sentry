import {Fragment} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import type {TeamWithProjects} from 'sentry/types/project';
import localStorage from 'sentry/utils/localStorage';
import useRouteAnalyticsEventNames from 'sentry/utils/routeAnalytics/useRouteAnalyticsEventNames';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useRouter from 'sentry/utils/useRouter';
import {useUserTeams} from 'sentry/utils/useUserTeams';
import Header from 'sentry/views/organizationStats/header';

import TeamStatsControls from './controls';
import DescriptionCard from './descriptionCard';
import TeamIssuesAge from './teamIssuesAge';
import TeamIssuesBreakdown from './teamIssuesBreakdown';
import TeamResolutionTime from './teamResolutionTime';
import {TeamUnresolvedIssues} from './teamUnresolvedIssues';
import {dataDatetime} from './utils';

export default function TeamStatsIssues() {
  const organization = useOrganization();
  const location = useLocation();
  const router = useRouter();
  const {teams, isLoading, isError} = useUserTeams();

  useRouteAnalyticsEventNames('team_insights.viewed', 'Team Insights: Viewed');

  const query = location?.query ?? {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;

  let localTeamId: string | null | undefined =
    (query.team as string | undefined) ?? localStorage.getItem(localStorageKey);
  if (localTeamId && !teams.some(team => team.id === localTeamId)) {
    localTeamId = null;
  }
  const currentTeamId = localTeamId ?? teams[0]?.id;
  const currentTeam = teams.find(team => team.id === currentTeamId) as
    | TeamWithProjects
    | undefined;
  const projects = currentTeam?.projects ?? [];
  const environment = query.environment as string | undefined;

  const {period, start, end, utc} = dataDatetime(query);

  if (teams.length === 0) {
    return (
      <NoProjectMessage organization={organization} superuserNeedsToBeProjectMember />
    );
  }

  if (isError) {
    return <LoadingError />;
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Team Issues')} orgSlug={organization.slug} />
      <Header organization={organization} activeTab="issues" />

      <div>
        <TeamStatsControls
          showEnvironment
          location={location}
          router={router}
          currentTeam={currentTeam}
          currentEnvironment={environment}
        />

        {isLoading && <LoadingIndicator />}
        {!isLoading && (
          <Layout.Main width="full">
            <DescriptionCard
              title={t('All Unresolved Issues')}
              description={t(
                'This includes New and Returning issues in the last 7 days as well as those that haven’t been resolved or archived in the past.'
              )}
            >
              <TeamUnresolvedIssues
                projects={projects}
                organization={organization}
                teamSlug={currentTeam!.slug}
                environment={environment}
                period={period}
                start={start}
                end={end}
                utc={utc}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('New and Returning Issues')}
              description={t(
                'The new, regressed, and escalating issues that were assigned to your team.'
              )}
            >
              <TeamIssuesBreakdown
                organization={organization}
                projects={projects}
                teamSlug={currentTeam!.slug}
                environment={environment}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                statuses={['new', 'regressed', 'escalating']}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('Issues Triaged')}
              description={t(
                'How many new and returning issues were reviewed by your team each week. Reviewing an issue includes marking as reviewed, resolving, assigning to another team, or deleting.'
              )}
            >
              <TeamIssuesBreakdown
                organization={organization}
                projects={projects}
                teamSlug={currentTeam!.slug}
                environment={environment}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                statuses={[
                  'resolved',
                  'deleted',
                  'archived_until_escalating',
                  'archived_forever',
                  'archived_until_condition_met',
                ]}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('Age of Unresolved Issues')}
              description={t('How long ago since unresolved issues were first created.')}
            >
              <TeamIssuesAge organization={organization} teamSlug={currentTeam!.slug} />
            </DescriptionCard>

            <DescriptionCard
              title={t('Time to Resolution')}
              description={t(
                `The mean time it took for issues to be resolved by your team.`
              )}
            >
              <TeamResolutionTime
                organization={organization}
                environment={environment}
                teamSlug={currentTeam!.slug}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
              />
            </DescriptionCard>
          </Layout.Main>
        )}
      </div>
    </Fragment>
  );
}
