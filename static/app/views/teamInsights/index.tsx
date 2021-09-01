import {Fragment, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';
import moment from 'moment';

import {Client} from 'app/api';
import {DateTimeObject} from 'app/components/charts/utils';
import * as Layout from 'app/components/layouts/thirds';
import Link from 'app/components/links/link';
import {getParams} from 'app/components/organizations/globalSelectionHeader/getParams';
import PageTimeRangeSelector from 'app/components/pageTimeRangeSelector';
import {DEFAULT_RELATIVE_PERIODS, DEFAULT_STATS_PERIOD} from 'app/constants';
import {t} from 'app/locale';
import space from 'app/styles/space';
import {Organization, SavedQueryVersions, TeamWithProjects} from 'app/types';
import EventView from 'app/utils/discover/eventView';
import withApi from 'app/utils/withApi';
import withOrganization from 'app/utils/withOrganization';
import withTeamsForUser from 'app/utils/withTeamsForUser';
import Table from 'app/views/performance/table';

import TeamDropdown from './teamDropdown';

type Props = {
  api: Client;
  organization: Organization;
  teams: TeamWithProjects[];
  loadingTeams: boolean;
  error: Error | null;
} & RouteComponentProps<{orgId: string}, {}>;

function TeamInsightsContainer({organization, teams, location}: Props) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const currentTeamId = selectedTeam ?? teams[0]?.id;
  const currentTeam = teams.find(team => team.id === currentTeamId);
  const projects = currentTeam?.projects ?? [];

  function handleUpdateDatetime() {}

  function dataDatetime(): DateTimeObject {
    const query = location?.query ?? {};

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
      return {period: DEFAULT_STATS_PERIOD};
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

    return {period: DEFAULT_STATS_PERIOD};
  }
  const {period, start, end, utc} = dataDatetime();

  const eventView = EventView.fromSavedQuery({
    id: undefined,
    name: 'Performance',
    query: 'transaction.duration:<15m team_key_transaction:true',
    projects: projects.map(project => Number(project.id)),
    version: 2 as SavedQueryVersions,
    orderby: '-tpm',
    // statsPeriod: period,
    start: start?.toString(),
    end: start?.toString(),
    fields: [
      'team_key_transaction',
      'transaction',
      'project',
      'tpm()',
      'p50()',
      'p95()',
      'failure_rate()',
      'apdex()',
      'count_unique(user)',
      'count_miserable(user)',
      'user_misery()',
    ],
  });

  return (
    <Fragment>
      <BorderlessHeader>
        <Layout.HeaderContent>
          <StyledLayoutTitle>{t('Team Insights')}</StyledLayoutTitle>
        </Layout.HeaderContent>
      </BorderlessHeader>
      <TabLayoutHeader>
        <Layout.HeaderNavTabs underlined>
          <li>
            <Link to={`/organizations/${organization.slug}/projects/`}>
              {t('Projects Overview')}
            </Link>
          </li>
          <li className="active">
            <Link to={`/organizations/${organization.slug}/teamInsights/`}>
              {t('Team Insights')}
            </Link>
          </li>
        </Layout.HeaderNavTabs>
      </TabLayoutHeader>
      <Layout.Body>
        <Layout.Main fullWidth>
          <ControlsWrapper>
            <TeamDropdown
              teams={teams}
              selectedTeam={currentTeamId}
              handleChangeFilter={selectedTeams => setSelectedTeam([...selectedTeams][0])}
            />
            <PageTimeRangeSelector
              organization={organization}
              relative={period ?? ''}
              start={start ?? null}
              end={end ?? null}
              utc={utc ?? null}
              onUpdate={handleUpdateDatetime}
              relativeOptions={DEFAULT_RELATIVE_PERIODS}
            />
          </ControlsWrapper>
          <Table
            eventView={eventView}
            projects={projects}
            organization={organization}
            location={location}
            setError={() => {}}
            summaryConditions={eventView.getQueryWithAdditionalConditions()}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

export default withApi(withOrganization(withTeamsForUser(TeamInsightsContainer)));

const BorderlessHeader = styled(Layout.Header)`
  border-bottom: 0;
`;

const TabLayoutHeader = styled(Layout.Header)`
  padding-top: 0;

  @media (max-width: ${p => p.theme.breakpoints[1]}) {
    padding-top: 0;
  }
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
