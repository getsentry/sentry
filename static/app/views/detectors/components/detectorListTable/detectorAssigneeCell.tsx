import styled from '@emotion/styled';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import type {Actor} from 'sentry/types/core';

type DetectorAssigneeCellProps = {
  assignee: Actor | null;
  className?: string;
  disabled?: boolean;
};

function AssigneeContent({assignee}: {assignee: Actor | null}) {
  if (!assignee) {
    return '—';
  }

  return <ActorAvatar actor={assignee} size={24} />;
}

export function DetectorAssigneeCell({assignee, className}: DetectorAssigneeCellProps) {
  return (
    <Wrapper className={className}>
      <AssigneeContent assignee={assignee} />
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  color: ${p => p.theme.tokens.content.secondary};
`;
