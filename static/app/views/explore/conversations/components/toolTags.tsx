import styled from '@emotion/styled';

import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {tn} from 'sentry/locale';
import type {ToolStat} from 'sentry/views/explore/conversations/hooks/useConversationToolStats';

interface ToolTagsProps {
  toolNames: string[];
  toolStats?: ToolStat[];
}

function formatDuration(ms: number): string {
  if (ms < 1000) {
    return `${Math.round(ms)}ms`;
  }
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = Math.round(seconds % 60);
  return `${minutes}m ${remainingSeconds}s`;
}

function ToolDropdown({
  toolNames,
  toolStats,
}: {
  toolNames: string[];
  toolStats?: ToolStat[];
}) {
  const statsByName = new Map(toolStats?.map(s => [s.name, s]) ?? []);

  return (
    <DropdownTable>
      {toolNames.map(name => {
        const stat = statsByName.get(name);
        return (
          <DropdownRow key={name}>
            <ToolNameCell>{name}</ToolNameCell>
            <CallsCell>
              {stat
                ? tn('%s call', '%s calls', stat.calls)
                : tn('%s call', '%s calls', 1)}
            </CallsCell>
            <DurationCell>
              {stat && stat.totalDuration > 0 ? formatDuration(stat.totalDuration) : '—'}
            </DurationCell>
          </DropdownRow>
        );
      })}
    </DropdownTable>
  );
}

export function ToolTags({toolNames, toolStats}: ToolTagsProps) {
  const statsByName = new Map(toolStats?.map(s => [s.name, s]) ?? []);

  let totalCalls = 0;
  let totalDuration = 0;
  for (const name of toolNames) {
    const stat = statsByName.get(name);
    totalCalls += stat?.calls ?? 1;
    totalDuration += stat?.totalDuration ?? 0;
  }

  return (
    <Tooltip
      title={<ToolDropdown toolNames={toolNames} toolStats={toolStats} />}
      skipWrapper
      isHoverable
    >
      <SummaryText>
        <Text variant="muted">
          {tn('%s call', '%s calls', totalCalls)}
          {totalDuration > 0 ? `  ${formatDuration(totalDuration)}` : ''}
        </Text>
      </SummaryText>
    </Tooltip>
  );
}

const SummaryText = styled('div')`
  cursor: default;
`;

const DropdownTable = styled('div')`
  display: grid;
  grid-template-columns: auto auto auto;
  gap: 4px 16px;
  padding: 4px 0;
  align-items: center;
`;

const DropdownRow = styled('div')`
  display: contents;
`;

const ToolNameCell = styled('span')`
  font-weight: 600;
  white-space: nowrap;
`;

const CallsCell = styled('span')`
  white-space: nowrap;
  text-align: right;
`;

const DurationCell = styled('span')`
  white-space: nowrap;
  text-align: right;
`;
