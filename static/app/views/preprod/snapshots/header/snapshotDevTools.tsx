import {useCallback, useEffect, useRef, useState} from 'react';
import {keyframes} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {Client} from 'sentry/api';
import {IconAdd, IconSubtract} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {SnapshotComparisonRunInfo} from 'sentry/views/preprod/types/snapshotTypes';

function formatDuration(ms: number): string {
  if (ms < 60_000) {
    return `${(ms / 1000).toFixed(1)}s`;
  }
  const minutes = Math.floor(ms / 60_000);
  const seconds = Math.round((ms % 60_000) / 1000);
  return `${minutes}m ${seconds}s`;
}

type Props = {
  hasBaseArtifact: boolean;
  organizationSlug: string;
  projectSlug: string;
  refetch: () => void;
  snapshotId: string;
  comparisonRunInfo?: SnapshotComparisonRunInfo;
};

export function SnapshotDevTools({
  organizationSlug,
  projectSlug,
  snapshotId,
  comparisonRunInfo,
  hasBaseArtifact,
  refetch,
}: Props) {
  const comparisonState = comparisonRunInfo?.state;
  const comparisonCompletedAt = comparisonRunInfo?.completed_at;
  const comparisonDurationMs = comparisonRunInfo?.duration_ms;
  const [devToolsCollapsed, setDevToolsCollapsed] = useState(
    () => localStorage.getItem('snapshot-dev-tools-collapsed') === 'true'
  );
  const [polling, setPolling] = useState(false);
  const [recompareLoading, setRecompareLoading] = useState(false);
  const [recompareError, setRecompareError] = useState<string | null>(null);
  const clientRef = useRef(new Client());

  useEffect(() => {
    if (comparisonState) {
      setPolling(true);
    } else {
      setPolling(false);
    }
  }, [comparisonState]);

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
      `/projects/${organizationSlug}/${projectSlug}/preprodartifacts/snapshots/${snapshotId}/recompare/`,
      {
        method: 'POST',
        success: () => {
          setRecompareLoading(false);
          setPolling(true);
          refetch();
        },
        error: (err: any) => {
          setRecompareLoading(false);
          setRecompareError(err?.responseJSON?.detail ?? 'Failed to recompare');
        },
      }
    );
  }, [organizationSlug, projectSlug, snapshotId, refetch]);

  let stateLabel: string;
  if (comparisonState === 'PROCESSING') {
    stateLabel = t('Processing...');
  } else if (comparisonState === 'PENDING') {
    stateLabel = t('Queued...');
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
                {formatDuration(comparisonDurationMs)}
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
        </Flex>
      )}
      {!devToolsCollapsed && recompareError && (
        <ErrorText size="xs">{recompareError}</ErrorText>
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
  gap: ${space(0.5)};
  padding: ${space(0.75)} ${space(1)};
  border: 1px dashed ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};

  &:not([data-collapsed='true']) {
    padding-right: 48px;
  }
`;

const CollapseButton = styled(Button)`
  position: absolute;
  top: ${space(0.5)};
  right: ${space(0.5)};
`;

const StatusPill = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  padding: 2px ${space(0.75)};
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

const ErrorText = styled(Text)`
  color: ${p => p.theme.colors.red300};
`;
