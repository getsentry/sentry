import {Fragment, useEffect} from 'react';
import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import pick from 'lodash/pick';
import moment from 'moment';

import {DateTimeObject} from 'sentry/components/charts/utils';
import TeamSelector from 'sentry/components/forms/teamSelector';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DateString, RelativePeriod, TeamWithProjects} from 'sentry/types';
import trackAdvancedAnalyticsEvent from 'sentry/utils/analytics/trackAdvancedAnalyticsEvent';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';
import useTeams from 'sentry/utils/useTeams';

import Header from '../header';

import DescriptionCard from './descriptionCard';
import TeamAlertsTriggered from './teamAlertsTriggered';
import TeamIssuesAge from './teamIssuesAge';
import TeamIssuesBreakdown from './teamIssuesBreakdown';
import TeamIssuesReviewed from './teamIssuesReviewed';
import TeamMisery from './teamMisery';
import TeamReleases from './teamReleases';
import TeamResolutionTime from './teamResolutionTime';
import TeamStability from './teamStability';
import TeamUnresolvedIssues from './teamUnresolvedIssues';

const INSIGHTS_DEFAULT_STATS_PERIOD = '8w';

const PAGE_QUERY_PARAMS = [
  'pageStatsPeriod',
  'pageStart',
  'pageEnd',
  'pageUtc',
  'dataCategory',
  'transform',
  'sort',
  'query',
  'cursor',
  'team',
];

type Props = {} & RouteComponentProps<{orgId: string}, {}>;

function TeamInsightsOverview({location, router}: Props) {
  const isSuperuser = isActiveSuperuser();
  const organization = useOrganization();
  const {teams, initiallyLoaded} = useTeams({provideUserTeams: true});
  const theme = useTheme();

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

  useEffect(() => {
    trackAdvancedAnalyticsEvent('team_insights.viewed', {
      organization,
    });
  }, []);

  function handleChangeTeam(teamId: string) {
    localStorage.setItem(localStorageKey, teamId);
    setStateOnUrl({team: teamId});
  }

  function handleUpdateDatetime(datetime: ChangeData): LocationDescriptorObject {
    const {start, end, relative, utc} = datetime;

    if (start && end) {
      const parser = utc ? moment.utc : moment;

      return setStateOnUrl({
        pageStatsPeriod: undefined,
        pageStart: parser(start).format(),
        pageEnd: parser(end).format(),
        pageUtc: utc ?? undefined,
      });
    }

    return setStateOnUrl({
      pageStatsPeriod: (relative as RelativePeriod) || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
    });
  }

  function setStateOnUrl(nextState: {
    pageStatsPeriod?: RelativePeriod;
    pageStart?: DateString;
    pageEnd?: DateString;
    pageUtc?: boolean | null;
    team?: string;
  }): LocationDescriptorObject {
    const nextQueryParams = pick(nextState, PAGE_QUERY_PARAMS);

    const nextLocation = {
      ...location,
      query: {
        ...query,
        ...nextQueryParams,
      },
    };

    router.push(nextLocation);

    return nextLocation;
  }

  function dataDatetime(): DateTimeObject {
    const {
      start,
      end,
      statsPeriod,
      utc: utcString,
    } = normalizeDateTimeParams(query, {
      allowEmptyPeriod: true,
      allowAbsoluteDatetime: true,
      allowAbsolutePageDatetime: true,
    });

    if (!statsPeriod && !start && !end) {
      return {period: INSIGHTS_DEFAULT_STATS_PERIOD};
    }

    // Following getParams, statsPeriod will take priority over start/end
    if (statsPeriod) {
      return {period: statsPeriod};
    }

    const utc = utcString === 'true';
    if (start && end) {
      return utc
        ? {
            start: moment.utc(start).format(),
            end: moment.utc(end).format(),
            utc,
          }
        : {
            start: moment(start).utc().format(),
            end: moment(end).utc().format(),
            utc,
          };
    }

    return {period: INSIGHTS_DEFAULT_STATS_PERIOD};
  }
  const {period, start, end, utc} = dataDatetime();

  if (teams.length === 0) {
    return (
      <NoProjectMessage organization={organization} superuserNeedsToBeProjectMember />
    );
  }

  const isInsightsV2 = organization.features.includes('team-insights-v2');

  return (
    <Fragment>
      <Header organization={organization} activeTab="team" />

      <Body>
        {!initiallyLoaded && <LoadingIndicator />}
        {initiallyLoaded && (
          <Layout.Main fullWidth>
            <ControlsWrapper>
              <StyledTeamSelector
                name="select-team"
                inFieldLabel={t('Team: ')}
                value={currentTeam?.slug}
                onChange={choice => handleChangeTeam(choice.actor.id)}
                teamFilter={isSuperuser ? undefined : filterTeam => filterTeam.isMember}
                styles={{
                  singleValue(provided: any) {
                    const custom = {
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      fontSize: theme.fontSizeMedium,
                      ':before': {
                        ...provided[':before'],
                        color: theme.textColor,
                        marginRight: space(1.5),
                        marginLeft: space(0.5),
                      },
                    };
                    return {...provided, ...custom};
                  },
                  input: (provided: any, state: any) => ({
                    ...provided,
                    display: 'grid',
                    gridTemplateColumns: 'max-content 1fr',
                    alignItems: 'center',
                    gridGap: space(1),
                    ':before': {
                      backgroundColor: state.theme.backgroundSecondary,
                      height: 24,
                      width: 38,
                      borderRadius: 3,
                      content: '""',
                      display: 'block',
                    },
                  }),
                }}
              />
              <StyledPageTimeRangeSelector
                organization={organization}
                relative={period ?? ''}
                start={start ?? null}
                end={end ?? null}
                utc={utc ?? null}
                onUpdate={handleUpdateDatetime}
                showAbsolute={false}
                relativeOptions={{
                  '14d': t('Last 2 weeks'),
                  '4w': t('Last 4 weeks'),
                  [INSIGHTS_DEFAULT_STATS_PERIOD]: t('Last 8 weeks'),
                  '12w': t('Last 12 weeks'),
                }}
              />
            </ControlsWrapper>

            <SectionTitle>{t('Project Health')}</SectionTitle>
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

            <SectionTitle>{t('Team Activity')}</SectionTitle>
            {!isInsightsV2 && (
              <DescriptionCard
                title={t('Issues Reviewed')}
                description={t(
                  'Issues triaged by your team taking an action on them such as resolving, ignoring, marking as reviewed, or deleting.'
                )}
              >
                <TeamIssuesReviewed
                  organization={organization}
                  projects={projects}
                  teamSlug={currentTeam!.slug}
                  period={period}
                  start={start?.toString()}
                  end={end?.toString()}
                  location={location}
                />
              </DescriptionCard>
            )}
            {isInsightsV2 && (
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
                  period={period}
                  start={start?.toString()}
                  end={end?.toString()}
                  location={location}
                  statuses={['new', 'regressed', 'unignored']}
                />
              </DescriptionCard>
            )}
            {isInsightsV2 && (
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
                  period={period}
                  start={start?.toString()}
                  end={end?.toString()}
                  location={location}
                  statuses={['resolved', 'ignored', 'deleted']}
                />
              </DescriptionCard>
            )}
            {isInsightsV2 && (
              <DescriptionCard
                title={t('Age of Unresolved Issues')}
                description={t(
                  'How long ago since unresolved issues were first created.'
                )}
              >
                <TeamIssuesAge organization={organization} teamSlug={currentTeam!.slug} />
              </DescriptionCard>
            )}
            {isInsightsV2 && (
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
                  period={period}
                  start={start}
                  end={end}
                  utc={utc}
                />
              </DescriptionCard>
            )}
            <DescriptionCard
              title={t('Time to Resolution')}
              description={t(
                `The mean time it took for issues to be resolved by your team.`
              )}
            >
              <TeamResolutionTime
                organization={organization}
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

export default TeamInsightsOverview;

const Body = styled(Layout.Body)`
  margin-bottom: -20px;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
  }
`;

const ControlsWrapper = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 246px 1fr;
  }
`;

const StyledTeamSelector = styled(TeamSelector)`
  & > div {
    box-shadow: ${p => p.theme.dropShadowLight};
  }
`;

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  height: 40px;

  div {
    min-height: unset;
  }
`;

const SectionTitle = styled(Layout.Title)`
  margin-bottom: ${space(1)} !important;
`;
