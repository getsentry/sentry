import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Button, LinkButton} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {SectionHeading} from 'sentry/components/charts/styles';
import {StackTraceContent} from 'sentry/components/events/interfaces/crashContent/stackTrace';
import {StackTraceContentPanel} from 'sentry/components/events/interfaces/crashContent/stackTrace/content';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconChevron, IconProfiling} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EntryType, type EventTransaction, type Frame} from 'sentry/types/event';
import type {PlatformKey} from 'sentry/types/project';
import {StackView} from 'sentry/types/stacktrace';
import {defined} from 'sentry/utils';
import {formatPercentage} from 'sentry/utils/number/formatPercentage';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {Frame as ProfilingFrame} from 'sentry/utils/profiling/frame';
import type {Profile} from 'sentry/utils/profiling/profile/profile';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import {formatTo} from 'sentry/utils/profiling/units/units';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useProfileGroup} from 'sentry/views/profiling/profileGroupProvider';

import type {SpanType} from './types';

const MAX_STACK_DEPTH = 8;
const MAX_TOP_NODES = 5;
const MIN_TOP_NODES = 3;
const TOP_NODE_MIN_COUNT = 3;

interface SpanProfileDetailsProps {
  event: Readonly<EventTransaction>;
  span: Readonly<SpanType>;
  onNoProfileFound?: () => void;
}

export function useSpanProfileDetails(event: any, span: any) {
  const profileGroup = useProfileGroup();

  const processedEvent = useMemo(() => {
    const entries: EventTransaction['entries'] = [...(event.entries || [])];
    if (profileGroup.images) {
      entries.push({
        data: {images: profileGroup.images},
        type: EntryType.DEBUGMETA,
      });
    }
    return {...event, entries};
  }, [event, profileGroup]);

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

    // The most recent profile formats should contain a timestamp indicating
    // the beginning of the profile. This timestamp can be after the start
    // timestamp on the transaction, so we need to account for the gap and
    // make sure the relative start timestamps we compute for the span is
    // relative to the start of the profile.
    //
    // If the profile does not contain a timestamp, we fall back to using the
    // start timestamp on the transaction. This won't be as accurate but it's
    // the next best thing.
    const startTimestamp = profile.timestamp ?? event.startTimestamp;

    const relativeStartTimestamp = formatTo(
      span.start_timestamp - startTimestamp,
      'second',
      profile.unit
    );
    const relativeStopTimestamp = formatTo(
      span.timestamp - startTimestamp,
      'second',
      profile.unit
    );

    return getTopNodes(profile, relativeStartTimestamp, relativeStopTimestamp).filter(
      hasApplicationFrame
    );
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
      if (nodes[i]!.count >= TOP_NODE_MIN_COUNT) {
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
      frames: extractFrames(nodes[index]!, event.platform || 'other'),
      hasPrevious: index > 0,
      hasNext: index + 1 < maxNodes,
    };
  }, [index, maxNodes, event, nodes]);

  return {
    processedEvent,
    profileGroup,
    profile,
    nodes,
    index,
    setIndex,
    totalWeight,
    maxNodes,
    frames,
    hasPrevious,
    hasNext,
  };
}

export function SpanProfileDetails({
  event,
  span,
  onNoProfileFound,
}: SpanProfileDetailsProps) {
  const organization = useOrganization();
  const {projects} = useProjects();
  const project = projects.find(p => p.id === event.projectID);
  const {
    processedEvent,
    profileGroup,
    profile,
    nodes,
    index,
    setIndex,
    maxNodes,
    hasNext,
    hasPrevious,
    totalWeight,
    frames,
  } = useSpanProfileDetails(event, span);

  const spanTarget =
    project &&
    profileGroup &&
    profileGroup.metadata.profileID &&
    profile &&
    generateProfileFlamechartRouteWithQuery({
      orgSlug: organization.slug,
      projectSlug: project.slug,
      profileId: profileGroup.metadata.profileID,
      query: {
        tid: String(profile.threadId),
        spanId: span.span_id,
        sorting: 'call order',
      },
    });

  if (!defined(profile) || !defined(spanTarget)) {
    return null;
  }

  if (!frames.length) {
    if (onNoProfileFound) {
      onNoProfileFound();
    }
    return null;
  }

  const percentage = formatPercentage(nodes[index]!.count / totalWeight);

  return (
    <SpanContainer>
      <SpanDetails>
        <SpanDetailsItem grow>
          <SectionHeading>{t('Most Frequent Stacks in this Span')}</SectionHeading>
        </SpanDetailsItem>
        <SpanDetailsItem>
          <SectionSubtext>
            {tct('Showing stacks [index] of [total] ([percentage])', {
              index: index + 1,
              total: maxNodes,
              percentage,
            })}
          </SectionSubtext>
        </SpanDetailsItem>
        <QuestionTooltip
          position="top"
          size="xs"
          title={t(
            '%s out of %s (%s) of the call stacks collected during this span',
            nodes[index]!.count,
            totalWeight,
            percentage
          )}
        />
        <SpanDetailsItem>
          <ButtonBar merged>
            <Button
              icon={<IconChevron direction="left" />}
              aria-label={t('Previous')}
              size="xs"
              disabled={!hasPrevious}
              onClick={() => {
                setIndex(prevIndex => prevIndex - 1);
              }}
            />
            <Button
              icon={<IconChevron direction="right" />}
              aria-label={t('Next')}
              size="xs"
              disabled={!hasNext}
              onClick={() => {
                setIndex(prevIndex => prevIndex + 1);
              }}
            />
          </ButtonBar>
        </SpanDetailsItem>
        <SpanDetailsItem>
          <LinkButton icon={<IconProfiling />} to={spanTarget} size="xs">
            {t('Profile')}
          </LinkButton>
        </SpanDetailsItem>
      </SpanDetails>
      <StackTraceContent
        event={processedEvent}
        newestFirst
        platform={event.platform || 'other'}
        stacktrace={{
          framesOmitted: null,
          hasSystemFrames: false,
          registers: null,
          frames,
        }}
        stackView={StackView.APP}
        inlined
        maxDepth={MAX_STACK_DEPTH}
      />
    </SpanContainer>
  );
}

function getTopNodes(
  profile: Profile,
  startTimestamp: any,
  stopTimestamp: any
): CallTreeNode[] {
  let duration = profile.startedAt;

  const callTree: CallTreeNode = new CallTreeNode(ProfilingFrame.Root, null);

  for (let i = 0; i < profile.samples.length; i++) {
    const sample = profile.samples[i]!;
    // TODO: should this take self times into consideration?
    const inRange = startTimestamp <= duration && duration < stopTimestamp;

    duration += profile.weights[i]!;

    if (sample.isRoot || !inRange) {
      continue;
    }

    const stack: CallTreeNode[] = [sample];
    let node: CallTreeNode | null = sample;

    while (node && !node.isRoot) {
      stack.push(node);
      node = node.parent;
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
      last.selfWeight += node.selfWeight;

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

function hasApplicationFrame(node: CallTreeNode | null) {
  while (node && !node.isRoot) {
    if (node.frame.is_application) {
      return true;
    }
    node = node.parent;
  }
  return false;
}

function extractFrames(node: CallTreeNode | null, platform: PlatformKey): Frame[] {
  const frames: Frame[] = [];

  while (node && !node.isRoot) {
    const frame = {
      absPath: node.frame.path ?? null,
      colNo: node.frame.column ?? null,
      context: [],
      filename: node.frame.file ?? null,
      function: node.frame.name ?? null,
      inApp: node.frame.is_application,
      instructionAddr: node.frame.instructionAddr ?? null,
      lineNo: node.frame.line ?? null,
      module: node.frame.module ?? null,
      package: node.frame.package ?? null,
      platform,
      rawFunction: null,
      symbol: node.frame.symbol ?? null,
      symbolAddr: node.frame.symbolAddr ?? null,
      symbolicatorStatus: node.frame.symbolicatorStatus,
      trust: null,
      vars: null,
    };

    frames.push(frame);
    node = node.parent;
  }

  // Profile stacks start from the inner most frame, while error stacks
  // start from the outer most frame. Reverse the order here to match
  // the convention on errors.
  return frames.reverse();
}

const SpanContainer = styled('div')`
  container: profiling-container / inline-size;
  border: 1px solid ${p => p.theme.innerBorder};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  ${StackTraceContentPanel} {
    margin-bottom: 0;
    box-shadow: none;
  }
`;
const SpanDetails = styled('div')`
  padding: ${space(0.5)} ${space(1)};
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const SpanDetailsItem = styled('span')<{grow?: boolean}>`
  flex: ${p => (p.grow ? '1 2 auto' : 'flex: 0 1 auto')};

  &:nth-child(2) {
    @container profiling-container (width < 680px) {
      display: none;
    }
  }

  &:first-child {
    flex: 0 1 100%;
    min-width: 0;
  }

  h4 {
    display: block;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    width: 100%;
  }
`;

const SectionSubtext = styled('span')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
`;
