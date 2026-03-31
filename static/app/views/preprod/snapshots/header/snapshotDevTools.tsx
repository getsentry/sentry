import {useCallback, useEffect, useMemo, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Client} from 'sentry/api';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {formatDuration} from 'sentry/utils/duration/formatDuration';
import {
  ComparisonState,
  type SnapshotComparisonRunInfo,
} from 'sentry/views/preprod/types/snapshotTypes';

interface SnapshotDevToolsProps {
  hasBaseArtifact: boolean;
  isSoloView: boolean;
  onToggleView: () => void;
  organizationSlug: string;
  refetch: () => void;
  snapshotId: string;
  comparisonRunInfo?: SnapshotComparisonRunInfo | null;
}

export function SnapshotDevTools({
  organizationSlug,
  snapshotId,
  comparisonRunInfo,
  hasBaseArtifact,
  refetch,
  isSoloView,
  onToggleView,
}: SnapshotDevToolsProps) {
  const comparisonState = comparisonRunInfo?.state;
  const comparisonCompletedAt = comparisonRunInfo?.completed_at;
  const comparisonDurationMs = comparisonRunInfo?.duration_ms;
  const [devToolsCollapsed, setDevToolsCollapsed] = useState(
    () => localStorage.getItem('snapshot-dev-tools-collapsed') === 'true'
  );
  const [recompareLoading, setRecompareLoading] = useState(false);
  const [recompareError, setRecompareError] = useState<string | null>(null);
  const clientRef = useRef(new Client());

  const polling = useMemo(
    () =>
      comparisonState === ComparisonState.PENDING ||
      comparisonState === ComparisonState.PROCESSING,
    [comparisonState]
  );

  useEffect(() => {
    if (!polling) {
      return undefined;
    }
    const interval = setInterval(() => refetch(), 1000);
    return () => clearInterval(interval);
  }, [polling, refetch]);

  const setCollapsed = (collapsed: boolean) => {
    setDevToolsCollapsed(collapsed);
    localStorage.setItem('snapshot-dev-tools-collapsed', String(collapsed));
  };

  const handleRecompare = useCallback(() => {
    setRecompareLoading(true);
    setRecompareError(null);
    clientRef.current.request(
      `/organizations/${organizationSlug}/preprodartifacts/snapshots/${snapshotId}/recompare/`,
      {
        method: 'POST',
        success: () => {
          setRecompareLoading(false);
          refetch();
        },
        error: (err: any) => {
          setRecompareLoading(false);
          setRecompareError(err?.responseJSON?.detail ?? 'Failed to recompare');
        },
      }
    );
  }, [organizationSlug, snapshotId, refetch]);

  let stateLabel: string;
  if (comparisonState === ComparisonState.PROCESSING) {
    stateLabel = t('Processing...');
  } else if (comparisonState === ComparisonState.PENDING) {
    stateLabel = t('Queued...');
  } else if (comparisonState === ComparisonState.FAILED) {
    stateLabel = t('Failed');
  } else if (comparisonCompletedAt) {
    stateLabel = t('Done');
  } else {
    stateLabel = t('No comparison');
  }

  return (
    <DevToolsBox data-collapsed={devToolsCollapsed}>
      {devToolsCollapsed ? (
        <Flex align="center" justify="center" gap="xs">
          <Text size="xs" variant="muted">
            {t('temp dev tools')}
          </Text>
          <Button
            size="zero"
            priority="transparent"
            icon={<IconAdd size="xs" />}
            aria-label={t('Expand')}
            onClick={() => setCollapsed(false)}
          />
        </Flex>
      ) : (
        <Flex direction="column" gap="sm">
          <CollapseButton
            size="zero"
            priority="transparent"
            icon={<IconSubtract size="xs" />}
            aria-label={t('Collapse')}
            onClick={() => setCollapsed(true)}
          />
          <Flex align="center" justify="center">
            <Text size="xs" variant="muted">
              {t('temp dev tools')}
            </Text>
          </Flex>
        </Flex>
      )}
      {!devToolsCollapsed && (
        <Flex align="center" gap="sm">
          <StatusPill>
            <Text size="xs" variant="muted">
              {t('Mode:')}
            </Text>
            <Text size="xs" bold>
              {hasBaseArtifact ? t('Diff') : t('Solo')}
            </Text>
          </StatusPill>
          <Text size="xs" variant="muted">
            {'|'}
          </Text>
          <StatusPill>
            <PulsingDot active={polling} />
            <Text size="xs" variant="muted">
              {t('State:')}
            </Text>
            <Text size="xs" bold>
              {stateLabel}
            </Text>
          </StatusPill>
          {comparisonCompletedAt && (
            <Text size="xs" variant="muted">
              {'|'}
            </Text>
          )}
          {comparisonCompletedAt && (
            <Flex align="center" gap="xs">
              <Text size="xs" variant="muted">
                {t('Last run:')}
              </Text>
              <Text size="xs" bold>
                {new Date(comparisonCompletedAt).toLocaleTimeString()}
              </Text>
            </Flex>
          )}
          {comparisonDurationMs !== undefined && (
            <Text size="xs" variant="muted">
              {'|'}
            </Text>
          )}
          {comparisonDurationMs !== undefined && (
            <Flex align="center" gap="xs">
              <Text size="xs" variant="muted">
                {t('comparison e2e:')}
              </Text>
              <Text size="xs" bold>
                {formatDuration({
                  duration: [comparisonDurationMs, 'ms'],
                  precision: 'sec',
                  style: 'h:mm:ss',
                })}
              </Text>
            </Flex>
          )}
          {hasBaseArtifact && (
            <Text size="xs" variant="muted">
              {'|'}
            </Text>
          )}
          {hasBaseArtifact && (
            <Button size="xs" onClick={handleRecompare} disabled={recompareLoading}>
              {recompareLoading ? t('Queuing...') : t('Re-run Comparison')}
            </Button>
          )}
          {hasBaseArtifact && (
            <Text size="xs" variant="muted">
              {'|'}
            </Text>
          )}
          {hasBaseArtifact && (
            <Button size="xs" onClick={onToggleView}>
              {isSoloView ? 'View as diff' : 'View as solo'}
            </Button>
          )}
        </Flex>
      )}
      {!devToolsCollapsed && recompareError && (
        <Text size="xs" variant="danger">
          {recompareError}
        </Text>
      )}
    </DevToolsBox>
  );
}

const pulse = keyframes`
  0%, 100% { opacity: 1; }
  50% { opacity: 0.3; }
`;

const DevToolsBox = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space.xs};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  &:not([data-collapsed='true']) {
    padding-right: 48px;
  }
`;

const CollapseButton = styled(Button)`
  position: absolute;
  top: ${p => p.theme.space.xs};
  right: ${p => p.theme.space.xs};
`;

const StatusPill = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  padding: 2px ${p => p.theme.space.sm};
  border: 1px solid ${p => p.theme.tokens.border.accent};
  border-radius: 12px;
`;

const PulsingDot = styled('div')<{active: boolean}>`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${p => (p.active ? p.theme.colors.yellow300 : p.theme.colors.gray200)};
  animation: ${p => (p.active ? pulse : 'none')} 1.2s ease-in-out infinite;
`;
