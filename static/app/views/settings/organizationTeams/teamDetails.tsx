import {useState} from 'react';
import {Outlet, useOutletContext} from 'react-router-dom';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Flex} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import IdBadge from 'sentry/components/idBadge';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Team} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useTeamsById} from 'sentry/utils/useTeamsById';

type TeamDetailsOutletContext = {
  team: Team;
};

function TeamDetailsOutlet(props: TeamDetailsOutletContext) {
  return <Outlet context={props} />;
}

export function useTeamDetailsOutlet() {
  return useOutletContext<TeamDetailsOutletContext>();
}

export default function TeamDetails() {
  const api = useApi();
  const location = useLocation();
  const orgSlug = useOrganization().slug;
  const [requesting, setRequesting] = useState(false);
  const params = useParams<{teamId: string}>();
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

  if (isLoading) {
    return <LoadingIndicator />;
  }

  if (!team || isError) {
    return (
      <Alert.Container>
        <Alert variant="warning" showIcon={false}>
          <div>{t('This team does not exist, or you do not have access to it.')}</div>
        </Alert>
      </Alert.Container>
    );
  }
  const routePrefix = `/settings/${orgSlug}/teams/${params.teamId}/`;
  const tab = location.pathname.split('/').at(-2);

  const activeTab = ['members', 'projects', 'notifications', 'settings'].includes(
    tab ?? ''
  )
    ? tab
    : 'members';

  return (
    <div>
      <SentryDocumentTitle title={t('Team Details')} orgSlug={orgSlug} />
      {team.hasAccess ? (
        <div>
          <h3>
            <IdBadge hideAvatar hideOverflow={false} team={team} avatarSize={36} />
          </h3>

          <TabsContainer>
            <Tabs value={activeTab}>
              <TabList>
                <TabList.Item key="members" to={`${routePrefix}members/`}>
                  {t('Members')}
                </TabList.Item>
                <TabList.Item key="projects" to={`${routePrefix}projects/`}>
                  {t('Projects')}
                </TabList.Item>
                <TabList.Item key="notifications" to={`${routePrefix}notifications/`}>
                  {t('Notifications')}
                </TabList.Item>
                <TabList.Item key="settings" to={`${routePrefix}settings/`}>
                  {t('Settings')}
                </TabList.Item>
              </TabList>
            </Tabs>
          </TabsContainer>

          <TeamDetailsOutlet team={team} />
        </div>
      ) : (
        <Alert.Container>
          <Alert variant="warning">
            <Flex justify="between" align="center">
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
            </Flex>
          </Alert>
        </Alert.Container>
      )}
    </div>
  );
}

const TabsContainer = styled('div')`
  margin-bottom: ${space(2)};
`;
