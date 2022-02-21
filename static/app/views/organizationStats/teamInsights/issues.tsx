import {Fragment, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {TeamWithProjects} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';
import useTeams from 'sentry/utils/useTeams';

import Header from '../header';

import TeamStatsControls from './controls';
import DescriptionCard from './descriptionCard';
import TeamIssuesAge from './teamIssuesAge';
import TeamIssuesBreakdown from './teamIssuesBreakdown';
import TeamResolutionTime from './teamResolutionTime';
import TeamUnresolvedIssues from './teamUnresolvedIssues';
import {dataDatetime} from './utils';

type Props = RouteComponentProps<{orgId: string}, {}>;

function TeamStatsIssues({location, router}: Props) {
  const organization = useOrganization();
  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});

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
  const environment = query.environment;

  useEffect(() => {
    trackAdvancedAnalyticsEvent('team_insights.viewed', {
      organization,
    });
  }, []);

  const {period, start, end, utc} = dataDatetime(query);

  if (teams.length === 0) {
    return (
      <NoProjectMessage organization={organization} superuserNeedsToBeProjectMember />
    );
  }

  return (
    <Fragment>
      <SentryDocumentTitle title={t('Team Issues')} orgSlug={organization.slug} />
      <Header organization={organization} activeTab="issues" />

      <Body>
        <TeamStatsControls
          showEnvironment
          location={location}
          router={router}
          currentTeam={currentTeam}
          currentEnvironment={environment}
        />

        {!initiallyLoaded && <LoadingIndicator />}
        {initiallyLoaded && (
          <Layout.Main fullWidth>
            <DescriptionCard
              title={t('All Unresolved Issues')}
              description={t(
                'This includes New and Returning issues in the last 7 days as well as those that haven’t been resolved or ignored in the past.'
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
                'The new, regressed, and unignored issues that were assigned to your team.'
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
                location={location}
                statuses={['new', 'regressed', 'unignored']}
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
                location={location}
                statuses={['resolved', 'ignored', 'deleted']}
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
                location={location}
              />
            </DescriptionCard>
          </Layout.Main>
        )}
      </Body>
    </Fragment>
  );
}

export default TeamStatsIssues;

const Body = styled(Layout.Body)`
  margin-bottom: -20px;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
  }
`;
