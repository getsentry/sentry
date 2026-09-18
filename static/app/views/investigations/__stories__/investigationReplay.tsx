import {useEffect, useRef, useState} from 'react';
import {useQueryClient} from '@tanstack/react-query';

import {Button} from '@sentry/scraps/button';
import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SegmentedControl} from '@sentry/scraps/segmentedControl';
import {Slider} from '@sentry/scraps/slider';
import {Text} from '@sentry/scraps/text';

import type {RequestOptions} from 'sentry/api';
import {IconPause, IconPlay, IconRefresh} from 'sentry/icons';
import {
  type FixtureHandler,
  type FixtureResponse,
  InvestigationFixtureApiProvider,
  investigationExecutionFixtureKey,
  NO_MATCH,
} from 'sentry/views/investigations/__stories__/investigationFixtureApi';
import {RecordedResponseInspector} from 'sentry/views/investigations/__stories__/recordedResponseInspector';
import {
  recordedFrameAt,
  recordedFrameIndexAt,
  recordedInvestigationRun,
  type RecordedFrame,
  type RecordedInvestigationRun,
  recordedPhaseMarkers,
} from 'sentry/views/investigations/__stories__/recordedRun';
import {
  createReplayClock,
  formatReplayClock,
  type ReplayClock,
  useReplayClock,
} from 'sentry/views/investigations/__stories__/replayClock';
import {InvestigationBootstrapPage} from 'sentry/views/investigations/detail';

const PLAYBACK_SPEEDS = ['1', '2', '4', '8', '16'] as const;
type PlaybackSpeed = (typeof PLAYBACK_SPEEDS)[number];

// The scrubber works in tenths of a second; the run is minutes long.
const SLIDER_STEP_MS = 100;

/**
 * Resolves with the frame the server was serving at the current playhead. A
 * request made before the first recorded response stays pending until the
 * clock reaches it, which is what the viewer saw: a request in flight.
 */
function resolveFrame<T>(
  frames: Array<RecordedFrame<T>>,
  clock: ReplayClock
): Promise<T> {
  const immediate = recordedFrameAt(frames, clock.getSnapshot().timeMs);
  if (immediate !== undefined) {
    return Promise.resolve(immediate);
  }

  return new Promise<T>(resolve => {
    const unsubscribe = clock.subscribe(() => {
      const body = recordedFrameAt(frames, clock.getSnapshot().timeMs);
      if (body !== undefined) {
        unsubscribe();
        resolve(body);
      }
    });
  });
}

function createRecordingHandler({
  clock,
  organizationSlug,
  run,
}: {
  clock: ReplayClock;
  organizationSlug: string;
  run: RecordedInvestigationRun;
}): FixtureHandler {
  const basePath = `/organizations/${organizationSlug}/investigations/`;

  return (path: string, options: Readonly<RequestOptions>) => {
    if (!path.startsWith(basePath)) {
      return NO_MATCH;
    }

    const method = options.method ?? 'GET';
    const parts = path.slice(basePath.length).split('/').filter(Boolean);
    const respond = (body: unknown): Promise<FixtureResponse> => Promise.resolve({body});

    // Nothing the viewer does can change a recording, and pretending otherwise
    // would quietly desync the page from the frames it is being served.
    if (method !== 'GET') {
      if (parts[0] === 'candidates') {
        return respond({items: []});
      }
      return Promise.reject(
        new Error(`${method} ${path} is not replayed: this run is a recording.`)
      );
    }

    if (parts.length === 0) {
      return resolveFrame(run.detail, clock).then(detail => ({body: [detail]}));
    }
    if (parts.length === 1) {
      return resolveFrame(run.detail, clock).then(detail => ({body: detail}));
    }
    if (parts[1] === 'orchestration' && parts.length === 2) {
      return resolveFrame(run.orchestration, clock).then(body => ({body}));
    }
    if (parts[1] === 'title-generation') {
      return resolveFrame(run.detail, clock).then(detail => ({
        body: {status: detail.titleGeneration?.status ?? null, preview: null},
      }));
    }

    const [, blocks, blockId, executions, executionId] = parts;
    if (blocks === 'blocks' && blockId && executions === 'executions' && executionId) {
      const frames =
        run.executions[investigationExecutionFixtureKey(blockId, executionId)];
      if (frames) {
        return resolveFrame(frames, clock).then(body => ({body}));
      }
      // The capture only polls executions that were still running. Anything
      // else had already finished by the time the page asked for it.
      return respond({
        id: executionId,
        status: 'completed',
        blocks: [],
        transcriptTruncated: false,
        pendingUserInput: null,
        partialMarkdown: null,
        error: null,
      });
    }

    return Promise.reject(new Error(`${method} ${path} is not part of the recording.`));
  };
}

/**
 * Pushes recorded responses into the page the moment the clock reaches them,
 * rather than waiting for the page's own poll interval to come around.
 */
function ReplayQuerySync({
  clock,
  run,
}: {
  clock: ReplayClock;
  run: RecordedInvestigationRun;
}) {
  const queryClient = useQueryClient();

  useEffect(() => {
    let previous = '';
    return clock.subscribe(() => {
      const {timeMs} = clock.getSnapshot();
      const signature = [
        recordedFrameIndexAt(run.detail, timeMs),
        recordedFrameIndexAt(run.orchestration, timeMs),
        ...Object.values(run.executions).map(frames =>
          recordedFrameIndexAt(frames, timeMs)
        ),
      ].join(':');

      if (signature === previous) {
        return;
      }
      previous = signature;
      queryClient.invalidateQueries({
        predicate: query =>
          query.queryKey.some(
            part => typeof part === 'string' && part.includes('/investigations/')
          ),
      });
    });
  }, [clock, queryClient, run]);

  return null;
}

function formatPhase(phase: string) {
  const spaced = phase.replace(/_/g, ' ');
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function PlaybackBar({clock, run}: {clock: ReplayClock; run: RecordedInvestigationRun}) {
  const {isPlaying, speed, timeMs} = useReplayClock(clock);
  const resumeAfterScrub = useRef(false);
  const markers = recordedPhaseMarkers(run);
  const currentMarker = markers.findLast(marker => marker.offsetMs <= timeMs);

  // Scrubbing pauses so the clock does not fight the drag, then resumes if it
  // was playing when the drag started.
  function scrubTo(nextTimeMs: number) {
    if (clock.getSnapshot().isPlaying) {
      resumeAfterScrub.current = true;
      clock.pause();
    }
    clock.seek(nextTimeMs);
  }

  function endScrub() {
    if (resumeAfterScrub.current) {
      resumeAfterScrub.current = false;
      clock.play();
    }
  }

  return (
    <Stack gap="md" padding="md" border="primary" radius="md" background="secondary">
      <Flex align="center" gap="md">
        <Button
          size="sm"
          variant="primary"
          icon={isPlaying ? <IconPause /> : <IconPlay />}
          aria-label={isPlaying ? 'Pause replay' : 'Play replay'}
          onClick={clock.toggle}
        />
        <Button
          size="sm"
          icon={<IconRefresh />}
          aria-label="Restart replay"
          onClick={() => clock.seek(0)}
        />
        <Container flex="1">
          <Slider
            aria-label="Replay position"
            max={run.durationMs}
            step={SLIDER_STEP_MS}
            value={Math.round(timeMs / SLIDER_STEP_MS) * SLIDER_STEP_MS}
            onChange={scrubTo}
            onChangeEnd={endScrub}
            formatOptions="hidden"
            ticks={{values: markers.map(marker => marker.offsetMs)}}
          />
        </Container>
        <Text size="sm" variant="muted" tabular>
          {formatReplayClock(timeMs)} / {formatReplayClock(run.durationMs)}
        </Text>
        <SegmentedControl
          size="xs"
          aria-label="Playback speed"
          value={String(speed) as PlaybackSpeed}
          onChange={value => clock.setSpeed(Number(value))}
        >
          {PLAYBACK_SPEEDS.map(option => (
            <SegmentedControl.Item key={option}>{`${option}×`}</SegmentedControl.Item>
          ))}
        </SegmentedControl>
      </Flex>

      <Flex gap="xs" wrap="wrap" align="center">
        {markers.map(marker => (
          <Button
            key={marker.offsetMs}
            size="xs"
            variant={
              marker.offsetMs === currentMarker?.offsetMs ? 'primary' : 'secondary'
            }
            onClick={() => clock.seek(marker.offsetMs)}
          >
            {`${formatPhase(marker.phase)} · ${formatReplayClock(marker.offsetMs)}`}
          </Button>
        ))}
      </Flex>
    </Stack>
  );
}

type InvestigationReplayProps = {
  organizationSlug: string;
  /** Defaults to the run captured from sentry.io. */
  run?: RecordedInvestigationRun;
};

/**
 * Replays a recorded agentic investigation against the real detail page, at
 * the pace it actually ran, with a playback bar for moving around in time.
 */
export function InvestigationReplay({
  organizationSlug,
  run = recordedInvestigationRun,
}: InvestigationReplayProps) {
  const [clock] = useState(() => createReplayClock(run.durationMs));
  const [handler] = useState(() =>
    createRecordingHandler({clock, organizationSlug, run})
  );

  useEffect(() => () => clock.destroy(), [clock]);

  return (
    <InvestigationFixtureApiProvider
      organizationSlug={organizationSlug}
      handler={handler}
    >
      <ReplayQuerySync clock={clock} run={run} />
      <Stack gap="md">
        <PlaybackBar clock={clock} run={run} />
        <Container minHeight="760px" border="primary" radius="md" overflow="hidden">
          <InvestigationBootstrapPage investigationId={run.investigationId} />
        </Container>
        <RecordedResponseInspector
          clock={clock}
          organizationSlug={organizationSlug}
          run={run}
        />
      </Stack>
    </InvestigationFixtureApiProvider>
  );
}
