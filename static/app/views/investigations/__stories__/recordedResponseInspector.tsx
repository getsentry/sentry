import {useMemo, useState} from 'react';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Text} from '@sentry/scraps/text';

import {JsonEventData} from 'sentry/components/structuredEventData/jsonEventData';
import {investigationExecutionFixtureKey} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import type {
  RecordedFrame,
  RecordedInvestigationRun,
} from 'sentry/views/investigations/__stories__/recordedRun';
import {
  formatReplayClock,
  type ReplayClock,
  useRecordedFrameIndex,
} from 'sentry/views/investigations/__stories__/replayClock';

/** One polled endpoint, and every distinct response it returned. */
type ResponseChannel = {
  frames: Array<RecordedFrame<unknown>>;
  key: string;
  label: string;
  path: string;
};

function responseChannels(
  run: RecordedInvestigationRun,
  organizationSlug: string
): ResponseChannel[] {
  const basePath = `/organizations/${organizationSlug}/investigations/${run.investigationId}/`;

  return [
    {key: 'detail', label: 'Detail', path: basePath, frames: run.detail},
    {
      key: 'orchestration',
      label: 'Orchestration',
      path: `${basePath}orchestration/`,
      frames: run.orchestration,
    },
    ...Object.entries(run.executions).map(([executionKey, frames]) => {
      const [blockId = '', executionId = ''] = executionKey.split(':');
      return {
        key: investigationExecutionFixtureKey(blockId, executionId),
        label: `Execution ${blockId}`,
        path: `${basePath}blocks/${blockId}/executions/${executionId}/`,
        frames,
      };
    }),
  ];
}

type RecordedResponseInspectorProps = {
  clock: ReplayClock;
  organizationSlug: string;
  run: RecordedInvestigationRun;
};

/**
 * The raw response the page is being served at the playhead. Scrubbing the
 * playback bar moves this in step with the UI above it, so a surprising piece
 * of rendering can be traced back to the payload that produced it.
 */
export function RecordedResponseInspector({
  clock,
  organizationSlug,
  run,
}: RecordedResponseInspectorProps) {
  const channels = useMemo(
    () => responseChannels(run, organizationSlug),
    [organizationSlug, run]
  );
  const [activeKey, setActiveKey] = useState(() => channels[1]?.key ?? 'detail');
  const activeChannel =
    channels.find(channel => channel.key === activeKey) ?? channels[0];

  // Expanding a key should survive switching channels and coming back, which
  // remounts the tree. Within one channel the tree stays mounted and keeps its
  // own state as the served response changes underneath it.
  const [expandedPaths, setExpandedPaths] = useState<Record<string, string[]>>({});

  const frames = activeChannel?.frames ?? [];
  const frameIndex = useRecordedFrameIndex(clock, frames);
  const frame = frameIndex === -1 ? undefined : frames[frameIndex];

  if (!activeChannel) {
    return null;
  }

  return (
    <Disclosure defaultExpanded size="sm">
      <Disclosure.Title>Response at the playhead</Disclosure.Title>
      <Disclosure.Content>
        <Stack gap="md" paddingTop="md">
          <Flex align="center" gap="md" wrap="wrap">
            <SegmentedControl
              size="xs"
              aria-label="Recorded endpoint"
              value={activeChannel.key}
              onChange={setActiveKey}
            >
              {channels.map(channel => (
                <SegmentedControl.Item key={channel.key}>
                  {channel.label}
                </SegmentedControl.Item>
              ))}
            </SegmentedControl>
            <Text size="sm" variant="muted" monospace>
              {`GET ${activeChannel.path}`}
            </Text>
          </Flex>

          <Text size="sm" variant="muted">
            {frame
              ? `Response ${frameIndex + 1} of ${frames.length} · arrived at ${formatReplayClock(frame.offsetMs)} · unchanged until ${
                  frames[frameIndex + 1]
                    ? formatReplayClock(frames[frameIndex + 1]!.offsetMs)
                    : formatReplayClock(run.durationMs)
                }`
              : `No response yet — the first one arrives at ${
                  frames[0] ? formatReplayClock(frames[0].offsetMs) : '—'
                }.`}
          </Text>

          <Container
            maxHeight="420px"
            overflow="auto"
            border="primary"
            radius="md"
            padding="md"
            background="primary"
          >
            {frame ? (
              <JsonEventData
                key={activeChannel.key}
                data={frame.body}
                showCopyButton
                // Show the top level and nothing below it. These payloads have
                // ~20 root keys, well past the default auto-collapse limit,
                // which would otherwise leave the whole response behind a
                // single `{ 18 items }` toggle.
                maxDefaultDepth={1}
                autoCollapseLimit={64}
                initialExpandedPaths={expandedPaths[activeChannel.key]}
                onToggleExpand={paths => {
                  setExpandedPaths(current => ({
                    ...current,
                    [activeChannel.key]: paths,
                  }));
                }}
              />
            ) : (
              <Text size="sm" variant="muted">
                The page has a request in flight.
              </Text>
            )}
          </Container>
        </Stack>
      </Disclosure.Content>
    </Disclosure>
  );
}
