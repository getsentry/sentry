import {useMemo} from 'react';

import StackTrace from 'sentry/components/events/interfaces/crashContent/stackTrace';
import {EventTransaction, Frame, PlatformType} from 'sentry/types/event';
import {STACK_VIEW} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame as ProfilingFrame} from 'sentry/utils/profiling/frame';
import {Profile} from 'sentry/utils/profiling/profile/profile';
import {formatTo} from 'sentry/utils/profiling/units/units';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import {SpanType} from './types';

interface SpanProfileDetailsProps {
  event: Readonly<EventTransaction>;
  span: Readonly<SpanType>;
}

export function SpanProfileDetails({event, span}: SpanProfileDetailsProps) {
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

  const frames = useMemo(() => {
    if (!nodes.length) {
      return [];
    }

    return extractFrames(nodes[0], event.platform || 'other');
  }, [event, nodes]);

  if (!defined(profile)) {
    return null;
  }

  if (!nodes.length) {
    return null;
  }

  return (
    <StackTrace
      event={event}
      hasHierarchicalGrouping
      newestFirst
      platform={event.platform || 'other'}
      stacktrace={{
        framesOmitted: null,
        hasSystemFrames: false,
        registers: null,
        frames,
      }}
      nativeV2
      stackView={STACK_VIEW.APP}
    />
  );
}

function getTopNodes(profile: Profile, startTimestamp, stopTimestamp): CallTreeNode[] {
  let duration = 0;

  const callTree: CallTreeNode = new CallTreeNode(ProfilingFrame.Root, null);

  for (const sample of profile.samples) {
    // TODO: should this take self times into consideration?
    const inRange = startTimestamp <= duration && duration < stopTimestamp;

    duration += sample.selfWeight;

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
    for (let i = stack.length - 1; i >= 0; i--) {
      node = stack[i]!;
      const frame = node.frame;

      // find a child in the current tree with the same frame,
      // merge the current node into it if it exists
      let last = tree.children.find(n => n.frame === frame);

      if (!defined(last)) {
        last = new CallTreeNode(frame, tree);
        tree.children.push(last);
      }

      // make sure to increment the count/weight so it can be sorted later
      last.incrementCount();
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

  while (node && !node.isRoot()) {
    frames.push({
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
    });

    node = node.parent;
  }

  return frames;
}
