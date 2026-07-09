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
const CONTENT_MIN_HEIGHT = 180;
const DETAIL_MIN_WIDTH = 400;
const DETAIL_MIN_HEIGHT = 200;
// The content pane defaults to 60% of the active axis (width in a row, height
// when stacked); SplitPanel resolves the percentage off its own measurement.
const CONTENT_DEFAULT_SIZE = '60%';
const SPLIT_LAYOUT_STORAGE_KEY = 'conversation-split-layout-size';

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

export function ConversationContentLayout({
  left,
  right,
  leftPadding = 'md',
}: {
  left: React.ReactNode;
  leftPadding?: React.ComponentProps<typeof Container>['padding'];
  right?: React.ReactNode;
}) {
  // Side by side above md, stacked below. SplitPanel resolves the orientation
  // container-aware and, in step with it, picks the axis-appropriate min sizes
  // and the percentage default — so no measurement dance is needed here.
  const [storedSize, setStoredSize] = useLocalStorageState<number | null>(
    SPLIT_LAYOUT_STORAGE_KEY,
    null
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
          <Flex height="100%" width="100%" minHeight="0" minWidth="0">
            <SplitPanel
              orientation={{xs: 'vertical', md: 'horizontal'}}
              defaultSize={CONTENT_DEFAULT_SIZE}
              initialSize={storedSize ?? undefined}
              minSize={{xs: CONTENT_MIN_HEIGHT, md: CONTENT_MIN_WIDTH}}
              fillMinSize={{xs: DETAIL_MIN_HEIGHT, md: DETAIL_MIN_WIDTH}}
              onResizeEnd={({endSize}) => setStoredSize(endSize)}
              sized={
                <Flex
                  direction="column"
                  flex="1"
                  minWidth="0"
                  minHeight="0"
                  paddingRight={{xs: '0', md: 'md'}}
                  paddingBottom={{xs: 'md', md: '0'}}
                >
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
                </Flex>
              }
              fill={
                right ? (
                  <Flex
                    direction="column"
                    flex="1"
                    minWidth="0"
                    minHeight="0"
                    paddingLeft={{xs: '0', md: 'md'}}
                    paddingTop={{xs: 'md', md: '0'}}
                  >
                    {right}
                  </Flex>
                ) : undefined
              }
            />
          </Flex>
        </Container>
      </ConversationLeftPanel>
    </Flex>
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
