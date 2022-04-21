import {RouteComponentProps} from 'react-router';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import {LocationDescriptorObject} from 'history';
import pick from 'lodash/pick';
import uniq from 'lodash/uniq';
import moment from 'moment';

import SelectControl from 'sentry/components/forms/selectControl';
import TeamSelector from 'sentry/components/forms/teamSelector';
import {ChangeData} from 'sentry/components/organizations/timeRangeSelector';
import PageTimeRangeSelector from 'sentry/components/pageTimeRangeSelector';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {DateString, TeamWithProjects} from 'sentry/types';
import {isActiveSuperuser} from 'sentry/utils/isActiveSuperuser';
import localStorage from 'sentry/utils/localStorage';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import {dataDatetime} from './utils';

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
  'environment',
];

type Props = Pick<RouteComponentProps<{orgId: string}, {}>, 'router' | 'location'> & {
  currentEnvironment?: string;
  currentTeam?: TeamWithProjects;
  showEnvironment?: boolean;
};

function TeamStatsControls({
  location,
  router,
  currentTeam,
  currentEnvironment,
  showEnvironment,
}: Props) {
  const {projects} = useProjects({
    slugs: currentTeam?.projects.map(project => project.slug) ?? [],
  });
  const organization = useOrganization();
  const isSuperuser = isActiveSuperuser();
  const theme = useTheme();

  const query = location?.query ?? {};
  const localStorageKey = `teamInsightsSelectedTeamId:${organization.slug}`;

  function handleChangeTeam(teamId: string) {
    localStorage.setItem(localStorageKey, teamId);
    // TODO(workflow): Preserve environment if it exists for the new team
    setStateOnUrl({team: teamId, environment: undefined});
  }

  function handleEnvironmentChange({value}: {label: string; value: string}) {
    if (value === '') {
      setStateOnUrl({environment: undefined});
    } else {
      setStateOnUrl({environment: value});
    }
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
      pageStatsPeriod: relative || undefined,
      pageStart: undefined,
      pageEnd: undefined,
      pageUtc: undefined,
    });
  }

  function setStateOnUrl(nextState: {
    environment?: string;
    pageEnd?: DateString;
    pageStart?: DateString;
    pageStatsPeriod?: string | null;
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

  const {period, start, end, utc} = dataDatetime(query);
  const environmentOptions = uniq(
    projects.map(project => project.environments).flat()
  ).map(env => ({label: env, value: env}));

  return (
    <ControlsWrapper showEnvironment={showEnvironment}>
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
      {showEnvironment && (
        <SelectControl
          options={[
            {
              value: '',
              label: t('All'),
            },
            ...environmentOptions,
          ]}
          value={currentEnvironment ?? ''}
          onChange={handleEnvironmentChange}
          styles={{
            input: (provided: any) => ({
              ...provided,
              display: 'grid',
              gridTemplateColumns: 'max-content 1fr',
              alignItems: 'center',
              gridGap: space(1),
              ':before': {
                height: 24,
                width: 90,
                borderRadius: 3,
                content: '""',
                display: 'block',
              },
            }),
            control: (base: any) => ({
              ...base,
              boxShadow: 'none',
            }),
            singleValue: (base: any) => ({
              ...base,
              fontSize: theme.fontSizeMedium,
              display: 'flex',
              ':before': {
                ...base[':before'],
                color: theme.textColor,
                marginRight: space(1.5),
              },
            }),
          }}
          inFieldLabel={t('Environment:')}
        />
      )}
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
  );
}

export default TeamStatsControls;

const ControlsWrapper = styled('div')<{showEnvironment?: boolean}>`
  display: grid;
  align-items: center;
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints[0]}) {
    grid-template-columns: 246px ${p => (p.showEnvironment ? '246px' : '')} 1fr;
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
