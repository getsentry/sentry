import {cloneElement, isValidElement, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import IdBadge from 'sentry/components/idBadge';
import ListLink from 'sentry/components/links/listLink';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NavTabs from 'sentry/components/navTabs';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{teamId: string}, {}>;

function TeamDetails({children}: Props) {
  const api = useApi();
  const params = useParams();
  const orgSlug = useOrganization().slug;
  const [requesting, setRequesting] = useState(false);
  const {teams, isLoading, isError} = useTeamsById({slugs: [params.teamId]});
  const team = teams.find(({slug}) => slug === params.teamId);

  function handleRequestAccess(teamSlug: string) {
    setRequesting(true);

    joinTeam(
      api,
      {
        orgId: orgSlug,
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

  const routePrefix = `/settings/${orgSlug}/teams/${params.teamId}/`;
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

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!team || isError) {
    return (
      <Alert.Container>
        <Alert type="warning">
          <div>{t('This team does not exist, or you do not have access to it.')}</div>
        </Alert>
      </Alert.Container>
    );
  }

  return (
    <div>
      <SentryDocumentTitle title={t('Team Details')} orgSlug={orgSlug} />
      {team.hasAccess ? (
        <div>
          <h3>
            <IdBadge hideAvatar hideOverflow={false} team={team} avatarSize={36} />
          </h3>

          <NavTabs underlined>{navigationTabs}</NavTabs>

          {isValidElement(children) ? cloneElement<any>(children, {team}) : null}
        </div>
      ) : (
        <Alert.Container>
          <Alert type="warning">
            <RequestAccessWrapper>
              <div>
                {tct('You do not have access to the [teamSlug] team.', {
                  teamSlug: <strong>{`#${team.slug}`}</strong>,
                })}
              </div>
              <Button
                disabled={requesting || team.isPending}
                size="sm"
                onClick={() => handleRequestAccess(team.slug)}
              >
                {team.isPending ? t('Request Pending') : t('Request Access')}
              </Button>
            </RequestAccessWrapper>
          </Alert>
        </Alert.Container>
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
