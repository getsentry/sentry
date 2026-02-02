import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Tooltip} from '@sentry/scraps/tooltip';

import Placeholder from 'sentry/components/placeholder';
import Section from 'sentry/components/workflowEngine/ui/section';
import {t} from 'sentry/locale';
import type {Detector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {useTeamsById} from 'sentry/utils/useTeamsById';
import useUserFromId from 'sentry/utils/useUserFromId';

function AssignToPlaceholder() {
  return (
    <Flex align="center" gap="xs">
      {t('Assign to')} <Placeholder width="80px" height="16px" />
    </Flex>
  );
}

function AssignToTeam({teamId}: {teamId: string}) {
  const organization = useOrganization();
  const {teams, isLoading} = useTeamsById({ids: [teamId]});
  const team = teams.find(tm => tm.id === teamId);

  if (isLoading) {
    return <AssignToPlaceholder />;
  }

  const teamName = `#${team?.slug ?? 'unknown'}`;
  return (
    <div>
      {t('Assign to')}{' '}
      {team?.slug ? (
        <Link to={`/settings/${organization.slug}/teams/${team?.slug}/`}>{teamName}</Link>
      ) : (
        teamName
      )}
    </div>
  );
}

function AssignToUser({userId}: {userId: string}) {
  const {isPending, data: user} = useUserFromId({id: parseInt(userId, 10)});

  if (isPending) {
    return <AssignToPlaceholder />;
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
