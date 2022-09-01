import {cloneElement, isValidElement, useState} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import Alert from 'sentry/components/alert';
import Button from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import ListLink from 'sentry/components/links/listLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {Team} from 'sentry/types';
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import useTeams from 'sentry/utils/useTeams';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{orgId: string; teamId: string}, {}>;

function TeamDetails({children, ...props}: Props) {
  const api = useApi();
  const [currentTeam, setCurrentTeam] = useState(
    TeamStore.getBySlug(props.params.teamId)
  );
  const [requesting, setRequesting] = useState(false);

  function handleRequestAccess(team: Team) {
    if (!team) {
      return;
    }

    setRequesting(true);

    joinTeam(
      api,
      {
        orgId: props.params.orgId,
        teamId: team.slug,
      },
      {
        success: () => {
          addSuccessMessage(
            tct('You have requested access to [team]', {
              team: `#${team.slug}`,
            })
          );
          setRequesting(false);
        },
        error: () => {
          addErrorMessage(
            tct('Unable to request access to [team]', {
              team: `#${team.slug}`,
            })
          );
          setRequesting(false);
        },
      }
    );
  }

  function onTeamChange(data: Team) {
    if (currentTeam !== data) {
      const orgId = props.params.orgId;
      browserHistory.replace(`/organizations/${orgId}/teams/${data.slug}/settings/`);
    } else {
      setCurrentTeam({...currentTeam, ...data});
    }
  }

  // `/organizations/${orgId}/teams/${teamId}`;
  const routePrefix = recreateRoute('', {
    routes: props.routes,
    params: props.params,
    stepBack: -1,
  });

  const navigationTabs = [
    <ListLink key={0} to={`${routePrefix}members/`}>
      {t('Members')}
    </ListLink>,
    <ListLink key={1} to={`${routePrefix}projects/`}>
      {t('Projects')}
    </ListLink>,
    <ListLink key={2} to={`${routePrefix}notifications/`}>
      {t('Notifications')}
    </ListLink>,
    <ListLink key={3} to={`${routePrefix}settings/`}>
      {t('Settings')}
    </ListLink>,
  ];

  const {teams, initiallyLoaded} = useTeams({slugs: [props.params.teamId]});

  return (
    <div>
      {initiallyLoaded ? (
        teams.length ? (
          teams.map((team, i) => {
            if (!team || !team.hasAccess) {
              return (
                <Alert type="warning">
                  {team ? (
                    <RequestAccessWrapper>
                      {tct('You do not have access to the [teamSlug] team.', {
                        teamSlug: <strong>{`#${team.slug}`}</strong>,
                      })}
                      <Button
                        disabled={requesting || team.isPending}
                        size="sm"
                        onClick={() => handleRequestAccess(team)}
                      >
                        {team.isPending ? t('Request Pending') : t('Request Access')}
                      </Button>
                    </RequestAccessWrapper>
                  ) : (
                    <div>{t('You do not have access to this team.')}</div>
                  )}
                </Alert>
              );
            }
            return (
              <div key={i}>
                <SentryDocumentTitle
                  title={t('Team Details')}
                  orgSlug={props.params.orgId}
                />
                <h3>
                  <IdBadge hideAvatar team={team} avatarSize={36} />
                </h3>

                <NavTabs underlined>{navigationTabs}</NavTabs>

                {isValidElement(children) &&
                  cloneElement(children, {
                    team,
                    onTeamChange: () => onTeamChange(team),
                  })}
              </div>
            );
          })
        ) : (
          <Alert type="warning">
            <div>{t('You do not have access to this team.')}</div>
          </Alert>
        )
      ) : (
        <LoadingIndicator />
      )}
    </div>
  );
}

export default TeamDetails;

const RequestAccessWrapper = styled('div')`
  display: flex;
  justify-content: space-between;
  align-items: center;
`;
