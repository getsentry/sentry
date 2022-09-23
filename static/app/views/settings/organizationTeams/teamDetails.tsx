import {cloneElement, isValidElement, useState} from 'react';
import type {RouteComponentProps} from 'react-router';
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
import recreateRoute from 'sentry/utils/recreateRoute';
import useApi from 'sentry/utils/useApi';
import useTeams from 'sentry/utils/useTeams';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{orgId: string; teamId: string}, {}>;

function TeamDetails({children, ...props}: Props) {
  const api = useApi();
  const [requesting, setRequesting] = useState(false);
  const {teams, initiallyLoaded} = useTeams({slugs: [props.params.teamId]});
  const team = teams.find(({slug}) => slug === props.params.teamId);

  function handleRequestAccess(teamSlug: string) {
    setRequesting(true);

    joinTeam(
      api,
      {
        orgId: props.params.orgId,
        teamId: teamSlug,
      },
      {
        success: () => {
          addSuccessMessage(
            tct('You have requested access to [team]', {
              team: `#${teamSlug}`,
            })
          );
          setRequesting(false);
        },
        error: () => {
          addErrorMessage(
            tct('Unable to request access to [team]', {
              team: `#${teamSlug}`,
            })
          );
          setRequesting(false);
        },
      }
    );
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

  if (!initiallyLoaded) {
    return <LoadingIndicator />;
  }

  if (!team) {
    return (
      <Alert type="warning">
        <div>{t('You do not have access to this team.')}</div>
      </Alert>
    );
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Team Details')} orgSlug={props.params.orgId} />
      {team.hasAccess ? (
        <div>
          <h3>
            <IdBadge hideAvatar team={team} avatarSize={36} />
          </h3>

          <NavTabs underlined>{navigationTabs}</NavTabs>

          {isValidElement(children) ? cloneElement<any>(children, {team}) : null}
        </div>
      ) : (
        <Alert type="warning">
          <RequestAccessWrapper>
            {tct('You do not have access to the [teamSlug] team.', {
              teamSlug: <strong>{`#${team.slug}`}</strong>,
            })}
            <Button
              disabled={requesting || team.isPending}
              size="sm"
              onClick={() => handleRequestAccess(team.slug)}
            >
              {team.isPending ? t('Request Pending') : t('Request Access')}
            </Button>
          </RequestAccessWrapper>
        </Alert>
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
