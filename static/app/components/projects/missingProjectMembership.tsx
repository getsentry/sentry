import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import {Button} from 'sentry/components/core/button';
import {Select} from 'sentry/components/core/select';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';

interface JoinTeamActionProps {
  organization: Organization;
  teamSlug: string;
}

function JoinTeamAction({teamSlug, organization}: JoinTeamActionProps) {
  const api = useApi({persistInFlight: true});
  const [isLoading, setIsLoading] = useState(false);
  const teamsInStore = useLegacyStore(TeamStore);
  const selectedTeam = teamsInStore.teams.find(team => team.slug === teamSlug);

  const handleJoinTeam = useCallback(() => {
    setIsLoading(true);

    joinTeam(
      api,
      {
        orgId: organization.slug,
        teamId: teamSlug,
      },
      {
        success: () => {
          setIsLoading(false);
          addSuccessMessage(t('Request to join team sent.'));
        },
        error: () => {
          setIsLoading(false);
          addErrorMessage(t('There was an error while trying to request access.'));
        },
      }
    );
  }, [api, organization.slug, teamSlug]);

  const openMembership = organization.features.includes('open-membership');

  if (!selectedTeam) {
    return null;
  }

  if (isLoading) {
    return <Button busy>{openMembership ? t('Join Team') : t('Request Access')}</Button>;
  }

  if (selectedTeam.isPending) {
    return <Button disabled>{t('Request Pending')}</Button>;
  }

  return (
    <Button priority="primary" onClick={handleJoinTeam}>
      {openMembership ? t('Join Team') : t('Request Access')}
    </Button>
  );
}

function getPendingTeamOption(pendingTeam: string) {
  return {
    value: pendingTeam,
    label: <DisabledLabel>{`#${pendingTeam}`}</DisabledLabel>,
  };
}

interface MissingProjectMembershipProps {
  organization: Organization;
  project: Project | undefined | null;
}

export default function MissingProjectMembership({
  organization,
  project,
}: MissingProjectMembershipProps) {
  const [team, setTeam] = useState<string | null>('');
  const teamsInStore = useLegacyStore(TeamStore);

  const teamAccess = useMemo(() => {
    const request: string[] = [];
    const pending: string[] = [];
    const pendingTeams = new Set<string>(
      teamsInStore.teams.filter(tm => tm.isPending).map(tm => tm.slug)
    );
    project?.teams?.forEach(({slug}) => {
      if (pendingTeams.has(slug)) {
        pending.push(slug);
      } else {
        request.push(slug);
      }
    });

    return [
      {
        label: t('Request Access'),
        options: request.map(requestingTeam => ({
          value: requestingTeam,
          label: `#${requestingTeam}`,
        })),
      },
      {
        label: t('Pending Requests'),
        options: pending.map(getPendingTeamOption),
      },
    ];
  }, [project, teamsInStore.teams]);

  const handleTeamChange = useCallback((teamObj: {value: string}) => {
    const selectedTeam = teamObj ? teamObj.value : null;
    setTeam(selectedTeam);
  }, []);

  const hasTeams = !!project?.teams?.length;
  return (
    <StyledPanel>
      {hasTeams ? (
        <EmptyMessage
          icon={<IconFlag />}
          title={t("You're not a member of this project.")}
          action={
            <Field>
              <StyledSelectControl
                name="select"
                placeholder={t('Select a Team')}
                options={teamAccess}
                onChange={handleTeamChange}
              />
              {team ? (
                <JoinTeamAction teamSlug={team} organization={organization} />
              ) : (
                <Button disabled>{t('Select a Team')}</Button>
              )}
            </Field>
          }
        >
          {t(`You'll need to join a team with access before you can view this data.`)}
        </EmptyMessage>
      ) : (
        <EmptyMessage icon={<IconFlag />}>
          {t(
            'No teams have access to this project yet. Ask an admin to add your team to this project.'
          )}
        </EmptyMessage>
      )}
    </StyledPanel>
  );
}

const StyledPanel = styled(Panel)`
  margin: ${space(2)} 0;
`;

const Field = styled('div')`
  display: grid;
  grid-auto-flow: column;
  gap: ${space(2)};
  text-align: left;
`;

const StyledSelectControl = styled(Select)`
  width: 250px;
`;

const DisabledLabel = styled('div')`
  display: flex;
  opacity: 0.5;
  overflow: hidden;
`;
