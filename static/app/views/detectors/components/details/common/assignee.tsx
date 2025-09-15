import {Flex} from 'sentry/components/core/layout/flex';
import {Tooltip} from 'sentry/components/core/tooltip';
import Placeholder from 'sentry/components/placeholder';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';

function AssignToTeam({teamId}: {teamId: string}) {
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);

  if (isLoading) {
    return (
      <Flex align="center" gap="xs">
        {t('Assign to')} <Placeholder width="80px" height="16px" />
      </Flex>
    );
  }

  return t('Assign to %s', `#${team?.slug ?? 'unknown'}`);
}

function AssignToUser({userId}: {userId: string}) {
  const {isPending, data: user} = useUserFromId({id: parseInt(userId, 10)});

  if (isPending) {
    return (
      <Flex align="center" gap="xs">
        {t('Assign to')} <Placeholder width="80px" height="16px" />
      </Flex>
    );
  }

  const title = user?.name ?? user?.email ?? t('Unknown user');
  return (
    <Tooltip title={title} showOnlyOnOverflow>
      {t('Assign to %s', title)}
    </Tooltip>
  );
}

function DetectorOwner({owner}: {owner: Detector['owner']}) {
  if (owner?.type === 'team') {
    return <AssignToTeam teamId={owner.id} />;
  }
  if (owner?.type === 'user') {
    return <AssignToUser userId={owner.id} />;
  }

  return t('Unassigned');
}

export function DetectorDetailsAssignee({owner}: {owner: Detector['owner']}) {
  return (
    <Section title={t('Assign')}>
      <DetectorOwner owner={owner} />
    </Section>
  );
}
