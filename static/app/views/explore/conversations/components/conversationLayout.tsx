import type React from 'react';
import {useRef} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {SplitPanel} from '@sentry/scraps/splitPanel';

import {Placeholder} from 'sentry/components/placeholder';
import {useDimensions} from 'sentry/utils/useDimensions';
import {useLocalStorageState} from 'sentry/utils/useLocalStorageState';
import {useOrganization} from 'sentry/utils/useOrganization';
import type {AITraceSpanNode} from 'sentry/views/insights/pages/agents/utils/types';

const LEFT_PANEL_MIN = 400;
const RIGHT_PANEL_MIN = 400;
const DIVIDER_WIDTH = 1;
const DEFAULT_STORAGE_KEY = 'conversation-split-size';

const CONTENT_MIN_WIDTH = 400;
const DETAIL_MIN_WIDTH = 360;

/**
 * Resizable two-column layout for conversation views.
 * Left panel holds messages/spans, right panel holds span details.
 * Uses SplitPanel for drag-to-resize with persisted size.
 */
export function ConversationSplitLayout({
  left,
  right,
  sizeStorageKey = DEFAULT_STORAGE_KEY,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  sizeStorageKey?: string;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});

  // Wait for the container to be measured before mounting the SplitPanel.
  // useLocalStorageState captures its default on first mount, so we need
  // width > 0 to compute a sensible half-width default for fresh visits.
  return (
    <Flex ref={measureRef} flex="1" minHeight="0" overflow="hidden">
      {width > 0 ? (
        <MeasuredSplitPanel width={width} sizeStorageKey={sizeStorageKey}>
          {{left, right}}
        </MeasuredSplitPanel>
      ) : null}
    </Flex>
  );
}

function MeasuredSplitPanel({
  children: {left, right},
  sizeStorageKey,
  width,
}: {
  children: {left: React.ReactNode; right: React.ReactNode};
  sizeStorageKey: string;
  width: number;
}) {
  // The sized pane's max is derived inside SplitPanel from `fillMinSize`, so we
  // only need a sensible half-width default here.
  const defaultLeft = Math.max(LEFT_PANEL_MIN, (width - DIVIDER_WIDTH) * 0.5);

  const [storedSize, setStoredSize] = useLocalStorageState(sizeStorageKey, defaultLeft);

  return (
    <SplitPanel
      orientation="horizontal"
      defaultSize={defaultLeft}
      initialSize={storedSize}
      minSize={LEFT_PANEL_MIN}
      fillMinSize={RIGHT_PANEL_MIN}
      onResizeEnd={({endSize}) => setStoredSize(endSize)}
      sized={left}
      fill={right}
    />
  );
}

export function ConversationLeftPanel({children}: {children: React.ReactNode}) {
  return (
    <Flex direction="column" flex={1} minWidth="0" minHeight="0" overflow="hidden">
      {children}
    </Flex>
  );
}

export function SpanDetailCard({
  children,
  embedded,
  ref,
}: {
  children: React.ReactNode;
  embedded?: boolean;
  ref?: React.Ref<HTMLDivElement>;
}) {
  return (
    <Stack
      ref={ref}
      background="primary"
      border={embedded ? undefined : 'primary'}
      radius={embedded ? undefined : 'md'}
      padding="xl"
      gap="lg"
      flex="1"
      minWidth="0"
      minHeight="0"
      height="100%"
      overflowY="auto"
      overflowX="hidden"
    >
      {children}
    </Stack>
  );
}

/**
 * Layout for the conversation content (transcript/timeline) and the span detail.
 * When a detail is shown it's a resizable side-by-side split. The content pane's
 * width persists under the shared conversation-split key, so a size set here (or
 * in the other conversation/trace views) carries over. With no detail, content
 * fills the whole area.
 */
export function ConversationTimelineLayout({
  left,
  right,
  leftPadding = 'md',
}: {
  left: React.ReactNode;
  leftPadding?: React.ComponentProps<typeof Container>['padding'];
  right?: React.ReactNode;
}) {
  const content = (
    <Container
      flex="1"
      minWidth="0"
      minHeight="0"
      padding={leftPadding}
      background="primary"
      border="primary"
      radius="md"
      overflowX="hidden"
      overflowY="auto"
    >
      {left}
    </Container>
  );

  return (
    <Flex flex="1" minWidth="0" minHeight="0" overflow="hidden">
      <ConversationLeftPanel>
        <Container
          containerType="inline-size"
          flex="1"
          minHeight="0"
          width="100%"
          background="secondary"
        >
          {right ? (
            <ConversationDetailSplit content={content} detail={right} />
          ) : (
            <Flex height="100%" width="100%" minHeight="0" overflow="hidden">
              {content}
            </Flex>
          )}
        </Container>
      </ConversationLeftPanel>
    </Flex>
  );
}

function ConversationDetailSplit({
  content,
  detail,
}: {
  content: React.ReactNode;
  detail: React.ReactNode;
}) {
  const measureRef = useRef<HTMLDivElement>(null);
  const {width} = useDimensions({elementRef: measureRef});

  // Measure first: useLocalStorageState captures its default on mount, so we
  // need the width to seed a half-content default for fresh visits.
  return (
    <Flex ref={measureRef} height="100%" width="100%" minHeight="0" minWidth="0">
      {width > 0 ? (
        <MeasuredDetailSplit width={width} content={content} detail={detail} />
      ) : null}
    </Flex>
  );
}

function MeasuredDetailSplit({
  width,
  content,
  detail,
}: {
  content: React.ReactNode;
  detail: React.ReactNode;
  width: number;
}) {
  // Size the content pane and persist under the shared conversation-split key,
  // so the width is interchangeable with the other conversation/trace views.
  const defaultContent = Math.max(CONTENT_MIN_WIDTH, (width - DIVIDER_WIDTH) * 0.5);
  const [storedSize, setStoredSize] = useLocalStorageState(
    DEFAULT_STORAGE_KEY,
    defaultContent
  );

  return (
    <SplitPanel
      orientation="horizontal"
      defaultSize={defaultContent}
      initialSize={storedSize}
      minSize={CONTENT_MIN_WIDTH}
      fillMinSize={DETAIL_MIN_WIDTH}
      onResizeEnd={({endSize}) => setStoredSize(endSize)}
      sized={
        <Flex direction="column" flex="1" minWidth="0" minHeight="0" paddingRight="md">
          {content}
        </Flex>
      }
      fill={
        <Flex direction="column" flex="1" minWidth="0" minHeight="0" paddingLeft="md">
          {detail}
        </Flex>
      }
    />
  );
}

export function ConversationDetailPanel({
  selectedNode,
  nodeTraceMap,
  initiallyCollapseAiIO = true,
}: {
  nodeTraceMap: Map<string, string>;
  initiallyCollapseAiIO?: boolean;
  selectedNode?: AITraceSpanNode;
}) {
  const organization = useOrganization();
  return (
    <Flex
      direction="column"
      flex={1}
      minHeight="0"
      background="primary"
      overflowY="auto"
      overflowX="hidden"
    >
      {selectedNode?.renderDetails({
        node: selectedNode,
        manager: null,
        onParentClick: () => {},
        onTabScrollToNode: () => {},
        organization,
        replay: null,
        traceId: nodeTraceMap.get(selectedNode.id) ?? '',
        hideNodeActions: true,
        initiallyCollapseAiIO,
      })}
    </Flex>
  );
}

export function ConversationViewSkeleton() {
  return (
    <ConversationSplitLayout
      left={
        <ConversationLeftPanel>
          <Container borderBottom="primary" padding="md lg">
            <Flex gap="lg">
              <Placeholder height="14px" width="40px" />
              <Placeholder height="14px" width="40px" />
            </Flex>
          </Container>
          <Flex direction="column" flex="1" gap="md" padding="lg" background="secondary">
            <Flex direction="column" gap="sm" padding="sm md">
              <Placeholder height="12px" width="120px" />
              <Placeholder height="12px" width="80%" />
            </Flex>
            <Container background="primary" radius="md" border="primary" padding="sm md">
              <Flex direction="column" gap="sm">
                <Flex align="center" gap="sm">
                  <Placeholder height="12px" width="100px" />
                  <Placeholder height="12px" width="40px" />
                </Flex>
                <Container background="tertiary" radius="sm" padding="xs sm">
                  <Placeholder height="12px" width="150px" />
                </Container>
                <Placeholder height="12px" width="90%" />
                <Placeholder height="12px" width="70%" />
                <Placeholder height="12px" width="60%" />
              </Flex>
            </Container>
            <Flex direction="column" gap="sm" padding="sm md">
              <Placeholder height="12px" width="120px" />
              <Placeholder height="12px" width="60%" />
            </Flex>
            <Container background="primary" radius="md" border="primary" padding="sm md">
              <Flex direction="column" gap="sm">
                <Flex align="center" gap="sm">
                  <Placeholder height="12px" width="80px" />
                  <Placeholder height="12px" width="35px" />
                </Flex>
                <Placeholder height="12px" width="85%" />
                <Placeholder height="12px" width="50%" />
              </Flex>
            </Container>
          </Flex>
        </ConversationLeftPanel>
      }
      right={
        <Flex direction="column" gap="lg" padding="lg">
          <Flex direction="column" gap="sm">
            <Placeholder height="14px" width="180px" />
            <Placeholder height="16px" width="60px" />
          </Flex>
          <Flex direction="column" gap="sm">
            <Placeholder height="12px" width="80px" />
            <Placeholder height="12px" width="200px" />
          </Flex>
          <Flex direction="column" gap="sm">
            <Placeholder height="12px" width="60px" />
            <Placeholder height="12px" width="160px" />
          </Flex>
          <Flex direction="column" gap="sm">
            <Placeholder height="14px" width="80px" />
            <Placeholder height="80px" width="100%" />
          </Flex>
          <Flex direction="column" gap="sm">
            <Placeholder height="14px" width="80px" />
            <Placeholder height="120px" width="100%" />
          </Flex>
        </Flex>
      }
    />
  );
}
