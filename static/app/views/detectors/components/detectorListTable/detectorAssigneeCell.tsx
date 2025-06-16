import styled from '@emotion/styled';

import {ActorAvatar} from 'sentry/components/core/avatar/actorAvatar';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconSentry} from 'sentry/icons';
import {t} from 'sentry/locale';
import {parseActorIdentifier} from 'sentry/utils/parseActorIdentifier';

type DetectorAssigneeCellProps = {
  assignee: string | null;
  className?: string;
  disabled?: boolean;
};

function AssigneeContent({assignee}: {assignee: string | null}) {
  const actor = parseActorIdentifier(assignee);

  if (!actor) {
    return (
      <Tooltip title={t('Sentry')}>
        <IconSentry size="lg" data-test-id="assignee-sentry" />
      </Tooltip>
    );
  }

  return <ActorAvatar actor={actor} size={24} />;
}

export function DetectorAssigneeCell({
  assignee,
  disabled = false,
  className,
}: DetectorAssigneeCellProps) {
  return (
    <Wrapper disabled={disabled} className={className}>
      <AssigneeContent assignee={assignee} />
    </Wrapper>
  );
}

const Wrapper = styled('div')<{disabled: boolean}>`
  color: ${p => (p.disabled ? p.theme.disabled : p.theme.textColor)};
`;
