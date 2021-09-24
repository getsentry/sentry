import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import pick from 'lodash/pick';
import moment from 'moment';

import {Client} from 'app/api';
import {DateTimeObject, getDiffInMinutes} from 'app/components/charts/utils';
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
import TeamDropdown from './teamDropdown';
import TeamMisery from './teamMisery';
import TeamStability from './teamStability';

const INSIGHTS_DEFAULT_STATS_PERIOD = '8w';

type Props = {
  api: Client;
  organization: Organization;
  teams: TeamWithProjects[];
  loadingTeams: boolean;
  error: Error | null;
} & RouteComponentProps<{orgId: string}, {}>;

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

function TeamInsightsOverview({
  organization,
  teams,
  loadingTeams,
  location,
  router,
}: Props) {
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
    query?: string;
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
  const comparisonPeriod =
    getDiffInMinutes({period, start, end, utc}) > 1440 * 7 ? '7d' : '1d';

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
              <TeamDropdown
                teams={teams}
                selectedTeam={currentTeamId}
                handleChangeTeam={handleChangeTeam}
              />
              <StyledPageTimeRangeSelector
                organization={organization}
                relative={period ?? ''}
                start={start ?? null}
                end={end ?? null}
                utc={utc ?? null}
                onUpdate={handleUpdateDatetime}
                relativeOptions={{
                  '7d': t('Last 7 days'),
                  '14d': t('Last 14 days'),
                  '30d': t('Last 30 days'),
                  [INSIGHTS_DEFAULT_STATS_PERIOD]: t('Last 8 weeks'),
                  '90d': t('Last 90 days'),
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
                comparisonPeriod={comparisonPeriod}
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
                comparisonPeriod={comparisonPeriod}
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
  display: flex;
  align-items: center;
  gap: ${space(1)};
  margin-bottom: ${space(2)};
`;

const StyledPageTimeRangeSelector = styled(PageTimeRangeSelector)`
  flex-grow: 1;
`;

const SectionTitle = styled(Layout.Title)`
  margin-bottom: ${space(1)} !important;
`;
