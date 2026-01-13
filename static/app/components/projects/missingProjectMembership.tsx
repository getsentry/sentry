import {useCallback, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';
import {Grid} from '@sentry/scraps/layout';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {joinTeam} from 'sentry/actionCreators/teams';
import {Button} from 'sentry/components/core/button';
import EmptyMessage from 'sentry/components/emptyMessage';
import Panel from 'sentry/components/panels/panel';
import {IconFlag} from 'sentry/icons';
import {t} from 'sentry/locale';
import TeamStore from 'sentry/stores/teamStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
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
  const teamStoreData = useLegacyStore(TeamStore);
  const selectedTeam = teamStoreData.teams.find(team => team.slug === teamSlug);

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

interface MissingProjectMembershipProps {
  organization: Organization;
  project: Project | undefined | null;
}

export default function MissingProjectMembership({
  organization,
  project,
}: MissingProjectMembershipProps) {
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null);
  const teamStoreData = useLegacyStore(TeamStore);

  const teamOptions = useMemo(() => {
    const request: string[] = [];
    const pending: string[] = [];
    const pendingTeams = new Set<string>(
      teamStoreData.teams.filter(tm => tm.isPending).map(tm => tm.slug)
    );
    project?.teams?.forEach(({slug}) => {
      if (pendingTeams.has(slug)) {
        pending.push(slug);
      } else {
        request.push(slug);
      }
    });

    const hasOpenMembership = organization.features.includes('open-membership');
    return [
      {
        label: t('Pending Requests'),
        options: pending.map(pendingTeam => ({
          value: pendingTeam,
          label: `#${pendingTeam}`,
          disabled: true,
        })),
      },
      {
        label: hasOpenMembership ? t('Teams') : t('Request Access'),
        options: request.map(requestingTeam => ({
          value: requestingTeam,
          label: `#${requestingTeam}`,
        })),
      },
    ];
  }, [organization.features, project, teamStoreData.teams]);

  const hasTeams = !!project?.teams?.length;
  return (
    <Panel>
      {hasTeams ? (
        <EmptyMessage
          icon={<IconFlag />}
          title={t("You're not a member of this project.")}
          action={
            <Grid
              columns="minmax(200px, 300px) minmax(80px, 150px)"
              gap="md"
              justify="center"
            >
              <StyledCompactSelect
                searchable
                value={selectedTeam || undefined}
                trigger={triggerProps => (
                  <SelectTrigger.Button {...triggerProps}>
                    {selectedTeam ? `#${selectedTeam}` : t('Select a Team')}
                  </SelectTrigger.Button>
                )}
                emptyMessage={t('No teams found')}
                options={teamOptions}
                onChange={option => {
                  setSelectedTeam(option.value as string | null);
                }}
              />
              {selectedTeam ? (
                <JoinTeamAction teamSlug={selectedTeam} organization={organization} />
              ) : (
                <Button disabled>{t('Join Team')}</Button>
              )}
            </Grid>
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
    </Panel>
  );
}

// Parent EmptyMessage component is aligning text center, so we need to align the text left
const StyledCompactSelect = styled(CompactSelect)`
  width: 100%;
  text-align: left;
  > button {
    width: 100%;
  }
`;
