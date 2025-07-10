import styled from '@emotion/styled';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {parseActorIdentifier} from 'sentry/utils/parseActorIdentifier';

type DetectorAssigneeCellProps = {
  assignee: string | null;
  className?: string;
  disabled?: boolean;
};

function AssigneeContent({assignee}: {assignee: string | null}) {
  const actor = parseActorIdentifier(assignee);

  if (!actor) {
    return '—';
  }

  return <ActorAvatar actor={actor} size={24} />;
}

export function DetectorAssigneeCell({assignee, className}: DetectorAssigneeCellProps) {
  return (
    <Wrapper className={className}>
      <AssigneeContent assignee={assignee} />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  color: ${p => p.theme.subText};
`;
