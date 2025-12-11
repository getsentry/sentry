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
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import useApi from 'sentry/utils/useApi';

type Props = {
  organization: Organization;
  project?: Project | null;
};

function MissingProjectMembership({organization, project}: Props) {
  const api = useApi({persistInFlight: true});
  const [loading, setLoading] = useState(false);
  const [team, setTeam] = useState<string | null>('');

  const getTeamsForAccess = useCallback(() => {
    const request: string[] = [];
    const pending: string[] = [];
    const teams = project?.teams ?? [];
    teams.forEach(({slug}) => {
      const teamFromStore = TeamStore.getBySlug(slug);
      if (!teamFromStore) {
        return;
      }
      if (teamFromStore.isPending) {
        pending.push(teamFromStore.slug);
      } else {
        request.push(teamFromStore.slug);
      }
    });

    return [request, pending] as const;
  }, [project]);

  const getPendingTeamOption = useCallback((pendingTeam: string) => {
    return {
      value: pendingTeam,
      label: <DisabledLabel>{`#${pendingTeam}`}</DisabledLabel>,
    };
  }, []);

  const handleJoinTeam = useCallback(
    (teamSlug: string) => {
      setLoading(true);

      joinTeam(
        api,
        {
          orgId: organization.slug,
          teamId: teamSlug,
        },
        {
          success: () => {
            setLoading(false);
            addSuccessMessage(t('Request to join team sent.'));
          },
          error: () => {
            setLoading(false);
            addErrorMessage(t('There was an error while trying to request access.'));
          },
        }
      );
    },
    [api, organization.slug]
  );

  const renderJoinTeam = useCallback(
    (teamSlug: string, features: string[]) => {
      const selectedTeam = TeamStore.getBySlug(teamSlug);

      if (!selectedTeam) {
        return null;
      }
      if (loading) {
        if (features.includes('open-membership')) {
          return <Button busy>{t('Join Team')}</Button>;
        }
        return <Button busy>{t('Request Access')}</Button>;
      }
      if (selectedTeam?.isPending) {
        return <Button disabled>{t('Request Pending')}</Button>;
      }
      if (features.includes('open-membership')) {
        return (
          <Button priority="primary" onClick={() => handleJoinTeam(teamSlug)}>
            {t('Join Team')}
          </Button>
        );
      }
      return (
        <Button priority="primary" onClick={() => handleJoinTeam(teamSlug)}>
          {t('Request Access')}
        </Button>
      );
    },
    [handleJoinTeam, loading]
  );

  const teamAccess = useMemo(() => {
    const [request, pending] = getTeamsForAccess();

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
        options: pending.map(pendingTeam => getPendingTeamOption(pendingTeam)),
      },
    ];
  }, [getPendingTeamOption, getTeamsForAccess]);

  const handleTeamChange = useCallback((teamObj: {value: string}) => {
    const selectedTeam = teamObj ? teamObj.value : null;
    setTeam(selectedTeam);
  }, []);

  const teams = project?.teams ?? [];

  return (
    <StyledPanel>
      {teams.length ? (
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
                renderJoinTeam(team, organization.features)
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

export default MissingProjectMembership;
