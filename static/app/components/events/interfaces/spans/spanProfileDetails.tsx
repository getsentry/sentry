import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import StackTrace from 'sentry/components/events/interfaces/crashContent/stackTrace';
import Link from 'sentry/components/links/link';
import {Tooltip} from 'sentry/components/tooltip';
import {IconChevron, IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventTransaction, Frame, PlatformType} from 'sentry/types/event';
import {STACK_VIEW} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/formatters';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame as ProfilingFrame} from 'sentry/utils/profiling/frame';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {formatTo} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {SpanType} from './types';

const MAX_STACK_DEPTH = 16;
const MAX_TOP_NODES = 5;
const MIN_TOP_NODES = 3;
const TOP_NODE_MIN_COUNT = 3;

interface SpanProfileDetailsProps {
  event: Readonly<EventTransaction>;
  span: Readonly<SpanType>;
}

export function SpanProfileDetails({event, span}: SpanProfileDetailsProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);

  const profileGroup = useProfileGroup();

  // TODO: Pick another thread if it's more relevant.
  const threadId = useMemo(
    () => profileGroup.profiles[profileGroup.activeProfileIndex]?.threadId,
    [profileGroup]
  );

  const profile = useMemo(() => {
    if (!defined(threadId)) {
      return null;
    }
    return profileGroup.profiles.find(p => p.threadId === threadId) ?? null;
  }, [profileGroup.profiles, threadId]);

  const nodes: CallTreeNode[] = useMemo(() => {
    if (profile === null) {
      return [];
    }

    const relativeStartTimestamp = formatTo(
      span.start_timestamp - event.startTimestamp,
      'second',
      profile.unit
    );
    const relativeStopTimestamp = formatTo(
      span.timestamp - event.startTimestamp,
      'second',
      profile.unit
    );

    return getTopNodes(profile, relativeStartTimestamp, relativeStopTimestamp);
  }, [profile, span, event]);

  const [index, setIndex] = useState(0);

  const totalWeight = useMemo(
    () => nodes.reduce((count, node) => count + node.count, 0),
    [nodes]
  );

  const maxNodes = useMemo(() => {
    // find the number of nodes with the minimum number of samples
    let hasMinCount = 0;
    for (let i = 0; i < nodes.length; i++) {
      if (nodes[i].count >= TOP_NODE_MIN_COUNT) {
        hasMinCount += 1;
      } else {
        break;
      }
    }

    hasMinCount = Math.max(MIN_TOP_NODES, hasMinCount);

    return Math.min(nodes.length, MAX_TOP_NODES, hasMinCount);
  }, [nodes]);

  const {frames, hasPrevious, hasNext} = useMemo(() => {
    if (index >= maxNodes) {
      return {frames: [], hasPrevious: false, hasNext: false};
    }

    return {
      frames: extractFrames(nodes[index], event.platform || 'other'),
      hasPrevious: index > 0,
      hasNext: index + 1 < maxNodes,
    };
  }, [index, maxNodes, event, nodes]);

  const profileTarget =
    project &&
    profileGroup &&
    profile &&
    generateProfileFlamechartRouteWithQuery({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      profileId: profileGroup.traceID,
      query: {tid: String(profile.threadId)},
    });

  const spanTarget =
    project &&
    profileGroup &&
    profile &&
    generateProfileFlamechartRouteWithQuery({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      profileId: profileGroup.traceID,
      query: {
        tid: String(profile.threadId),
        spanId: span.span_id,
      },
    });

  const threadName = profile ? profile.name ?? `tid(${profile.threadId})` : t('unknown');

  if (!defined(profile) || !defined(profileTarget) || !defined(spanTarget)) {
    return null;
  }

  if (!frames.length) {
    return null;
  }

  return (
    <Fragment>
      <SpanDetails>
        <SpanDetailsItem grow>
          <Label>
            {tct('Thread [name] - Top Stacks ([index] of [total])', {
              name: <Link to={profileTarget}>{threadName}</Link>,
              index: index + 1,
              total: maxNodes,
            })}
          </Label>
        </SpanDetailsItem>
        <SpanDetailsItem>
          <Label>
            <Tooltip title={t('%s out of %s samples', nodes[index].count, totalWeight)}>
              {tct('[percentage]', {
                percentage: formatPercentage(nodes[index].count / totalWeight),
              })}
            </Tooltip>
          </Label>
        </SpanDetailsItem>
        <SpanDetailsItem>
          <Button icon={<IconProfiling />} to={spanTarget} size="sm">
            {t('View Profile')}
          </Button>
        </SpanDetailsItem>
        <SpanDetailsItem>
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" size="sm" />}
              aria-label={t('Previous')}
              size="sm"
              disabled={!hasPrevious}
              onClick={() => {
                setIndex(prevIndex => prevIndex - 1);
              }}
            />
            <Button
              icon={<IconChevron direction="right" size="sm" />}
              aria-label={t('Next')}
              size="sm"
              disabled={!hasNext}
              onClick={() => {
                setIndex(prevIndex => prevIndex + 1);
              }}
            />
          </ButtonBar>
        </SpanDetailsItem>
      </SpanDetails>
      <StackTrace
        event={event}
        hasHierarchicalGrouping
        newestFirst={false}
        platform={event.platform || 'other'}
        stacktrace={{
          framesOmitted: null,
          hasSystemFrames: false,
          registers: null,
          frames,
        }}
        nativeV2
        stackView={STACK_VIEW.APP}
        hideIcon
      />
    </Fragment>
  );
}

function getTopNodes(profile: Profile, startTimestamp, stopTimestamp): CallTreeNode[] {
  let duration = profile.startedAt;

  const callTree: CallTreeNode = new CallTreeNode(ProfilingFrame.Root, null);

  for (let i = 0; i < profile.samples.length; i++) {
    const sample = profile.samples[i];
    // TODO: should this take self times into consideration?
    const inRange = startTimestamp <= duration && duration < stopTimestamp;

    duration += profile.weights[i];

    if (sample.isRoot() || !inRange) {
      continue;
    }

    const stack: CallTreeNode[] = [sample];
    let node: CallTreeNode | null = sample;

    while (node && node.parent && !node.parent.isRoot()) {
      node = node.parent;
      stack.push(node);
    }

    let tree = callTree;

    // make sure to iterate the stack backwards here, the 0th index is the
    // inner most frame, and the last index is the outer most frame
    for (let j = stack.length - 1; j >= 0; j--) {
      node = stack[j]!;
      const frame = node.frame;

      // find a child in the current tree with the same frame,
      // merge the current node into it if it exists
      let last = tree.children.find(n => n.frame === frame);

      if (!defined(last)) {
        last = new CallTreeNode(frame, tree);
        tree.children.push(last);
      }

      // make sure to increment the count/weight so it can be sorted later
      last.count += node.count;
      last.addToSelfWeight(node.selfWeight);

      tree = last;
    }
  }

  const nodes: CallTreeNode[] = [];
  const trees = [callTree];

  while (trees.length) {
    const tree = trees.pop()!;

    // walk to the leaf nodes, these correspond with the inner most frame
    // on a stack
    if (tree.children.length === 0) {
      nodes.push(tree);
      continue;
    }

    trees.push(...tree.children);
  }

  return nodes.sort(sortByCount);
}

// TODO: does this work for android? The counts on the evented format may not be what we expect
function sortByCount(a: CallTreeNode, b: CallTreeNode) {
  if (a.count === b.count) {
    return b.selfWeight - a.selfWeight;
  }

  return b.count - a.count;
}

function extractFrames(node: CallTreeNode | null, platform: PlatformType): Frame[] {
  const frames: Frame[] = [];

  let framesCount = 0;
  let prevFrame: Frame | null = null;

  while (framesCount < MAX_STACK_DEPTH && node && !node.isRoot()) {
    const frame = {
      absPath: node.frame.path ?? null,
      colNo: node.frame.column ?? null,
      context: [],
      errors: null,
      filename: node.frame.file ?? null,
      function: node.frame.name ?? null,
      inApp: node.frame.is_application,
      instructionAddr: null,
      lineNo: node.frame.line ?? null,
      // TODO: distinguish between module/package
      module: node.frame.image ?? null,
      package: null,
      platform,
      rawFunction: null,
      symbol: null,
      symbolAddr: null,
      trust: null,
      vars: null,
    };

    if (
      // In app frames are not collapsed so count it.
      frame.inApp ||
      // Only count non in app frames if the previous frame is in app.
      // This is because a group of non in app frames will be collapsed
      // into a single frame, so we only count the entire group once.
      prevFrame?.inApp
    ) {
      framesCount += 1;
    }

    frames.push(frame);

    prevFrame = frame;

    node = node.parent;
  }

  return frames;
}

const SpanDetails = styled('div')`
  padding: ${space(2)};
  display: flex;
  align-items: baseline;
  gap: ${space(1)};
`;

const Label = styled('span')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
`;

const SpanDetailsItem = styled('span')<{grow?: boolean}>`
  ${p => (p.grow ? 'flex: 1 2 auto' : 'flex: 0 1 auto')}
`;
