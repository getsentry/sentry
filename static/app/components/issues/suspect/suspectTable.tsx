import {useState} from 'react';
import styled from '@emotion/styled';

import {SegmentedControl} from 'sentry/components/core/segmentedControl';
import SuspectFlags from 'sentry/components/issues/suspect/suspectFlags';
import useSuspectFlags from 'sentry/components/issues/suspect/useSuspectFlags';
import {space} from 'sentry/styles/space';
import type {Group} from 'sentry/types/group';

interface Props {
  environments: string[];
  group: Group;
}

export default function SuspectTable({environments, group}: Props) {
  const [displayMode, setDisplayMode] = useState<'filters' | 'filter_rrf' | 'rrf'>(
    'filters'
  );
  const {displayFlags, isPending, susFlags} = useSuspectFlags({
    environments,
    group,
    displayMode,
  });

  if (!displayFlags) {
    return null;
  }

  return (
    <GradientBox>
      <SegmentedControl size="xs" onChange={setDisplayMode} value={displayMode}>
        <SegmentedControl.Item key="filters">Heuristics Only</SegmentedControl.Item>
        <SegmentedControl.Item key="filter_rrf">
          Heuristics + Sort (RRF)
        </SegmentedControl.Item>
        <SegmentedControl.Item key="rrf">Sort (RRF)</SegmentedControl.Item>
      </SegmentedControl>
      <ScrolledBox>
        <SuspectFlags isPending={isPending} susFlags={susFlags} />
      </ScrolledBox>
    </GradientBox>
  );
}

const GradientBox = styled('div')`
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  background: linear-gradient(
    90deg,
    ${p => p.theme.backgroundSecondary}00 0%,
    ${p => p.theme.backgroundSecondary}FF 70%,
    ${p => p.theme.backgroundSecondary}FF 100%
  );
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.primary};
  padding: ${space(1)};
  height: max-content;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.md};
`;

const ScrolledBox = styled('div')`
  overflow: scroll;
  max-height: 300px;
`;
