import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import pick from 'lodash/pick';
import moment from 'moment';

import {Client} from 'app/api';
import {DateTimeObject} from 'app/components/charts/utils';
import TeamSelector from 'app/components/forms/teamSelector';
import * as Layout from 'app/components/layouts/thirds';
import LoadingIndicator from 'app/components/loadingIndicator';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import {ChangeData} from 'app/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'app/components/pageTimeRangeSelector';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {DateString, Organization, RelativePeriod, TeamWithProjects} from 'app/types';
import localStorage from 'app/utils/localStorage';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeamsForUser from 'app/utils/withTeamsForUser';

import DescriptionCard from './descriptionCard';
import HeaderTabs from './headerTabs';
import TeamAlertsTriggered from './teamAlertsTriggered';
import TeamIssuesReviewed from './teamIssuesReviewed';
import TeamMisery from './teamMisery';
import TeamReleases from './teamReleases';
import TeamResolutionTime from './teamResolutionTime';
import TeamStability from './teamStability';

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

type Props = {
  api: Client;
  organization: Organization;
  teams: TeamWithProjects[];
  loadingTeams: boolean;
  error: Error | null;
} & RouteComponentProps<{orgId: string}, {}>;

function TeamInsightsOverview({
  organization,
  teams,
  loadingTeams,
  location,
  router,
}: Props) {
  const theme = useTheme();
  const query = location?.query ?? {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;

  let localTeamId: string | null | undefined =
    query.team ?? localStorage.getItem(localStorageKey);
  if (localTeamId && !teams.find(team => team.id === localTeamId)) {
    localTeamId = null;
  }
  const currentTeamId = localTeamId ?? teams[0]?.id;
  const currentTeam = teams.find(team => team.id === currentTeamId);
  const projects = currentTeam?.projects ?? [];

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
    } = getParams(query, {
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

  return (
    <Fragment>
      <BorderlessHeader>
        <StyledHeaderContent>
          <StyledLayoutTitle>{t('Projects')}</StyledLayoutTitle>
        </StyledHeaderContent>
      </BorderlessHeader>
      <Layout.Header>
        <HeaderTabs organization={organization} activeTab="teamInsights" />
      </Layout.Header>

      <Body>
        {loadingTeams && <LoadingIndicator />}
        {!loadingTeams && (
          <Layout.Main fullWidth>
            <ControlsWrapper>
              <StyledTeamSelector
                name="select-team"
                inFieldLabel={t('Team: ')}
                value={currentTeam?.slug}
                isLoading={loadingTeams}
                onChange={choice => handleChangeTeam(choice.actor.id)}
                teamFilter={filterTeam => filterTeam.isMember}
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
                'The percentage of healthy, errored, and abnormal sessions that did not cause a crash.'
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
                'User Misery shows the number of unique users that experienced load times 4x the project’s configured threshold.'
              )}
            >
              <TeamMisery
                organization={organization}
                projects={projects}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                location={location}
              />
            </DescriptionCard>

            <DescriptionCard
              title={t('Metric Alerts Triggered')}
              description={t(
                'These are the alerts triggered from the Alert Rules your team created.'
              )}
            >
              <TeamAlertsTriggered
                organization={organization}
                teamSlug={currentTeam!.slug}
                period={period}
                start={start?.toString()}
                end={end?.toString()}
                location={location}
              />
            </DescriptionCard>

            <SectionTitle>{t('Team Activity')}</SectionTitle>
            <DescriptionCard
              title={t('Issues Reviewed')}
              description={t(
                'Issues that were triaged by your team taking an action on them such as resolving, ignoring, marking as reviewed, or deleting.'
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
            <DescriptionCard
              title={t('Time to Resolution')}
              description={t(
                `This shows the mean time it took for issues to be resolved by your team.
                 If issues took a long time to resolve, this could be a problem that your team needs to fix.`
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
              description={t(
                'A breakdown showing how your team shipped releases over time. This is a signal that team velocity is high or low.'
              )}
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

export {TeamInsightsOverview};
export default withApi(withOrganization(withTeamsForUser(TeamInsightsOverview)));

const Body = styled(Layout.Body)`
  margin-bottom: -20px;

  @media (min-width: ${p => p.theme.breakpoints[1]}) {
    display: block;
  }
`;

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;
`;

const StyledHeaderContent = styled(Layout.HeaderContent)`
  margin-bottom: 0;
`;

const StyledLayoutTitle = styled(Layout.Title)`
  margin-top: ${space(0.5)};
`;

const ControlsWrapper = styled('div')`
  display: grid;
  align-items: center;
  gap: ${space(1)};
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
