import styled from '@emotion/styled';

import SuspectFlags from 'sentry/components/issues/suspect/suspectFlags';
import useSuspectFlags from 'sentry/components/issues/suspect/useSuspectFlags';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';

interface Props {
  environments: string[];
  group: Group;
}

export default function SuspectTable({environments, group}: Props) {
  const {displayFlags, isPending, susFlags} = useSuspectFlags({
    environments,
    group,
  });

  if (!displayFlags) {
    return null;
  }

  return (
    <GradientBox>
      <SuspectFlags isPending={isPending} susFlags={susFlags} />
    </GradientBox>
  );
}

const GradientBox = styled('div')`
  border: 1px solid ${p => p.theme.border};
  background: ${p => p.theme.background};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.textColor};
  padding: ${space(1)};
  height: max-content;
  display: flex;
  flex-direction: column;
`;
