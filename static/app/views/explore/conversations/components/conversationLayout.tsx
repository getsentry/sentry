import type React from 'react';
import {useRef} from 'react';

import {Container, Flex} from '@sentry/scraps/layout';
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

  return (
    <Flex ref={measureRef} flex="1" minHeight="0" overflow="hidden">
      {width > 0 ? (
        <ConversationSplitInner
          width={width}
          left={left}
          right={right}
          sizeStorageKey={sizeStorageKey}
        />
      ) : null}
    </Flex>
  );
}

/**
 * Holds the persisted size. Only mounted once the container width has been
 * measured so `defaultLeft` (the 50% default) is computed from the real width
 * rather than 0 — otherwise `useLocalStorageState` would freeze the initial
 * size at the minimum.
 */
function ConversationSplitInner({
  width,
  left,
  right,
  sizeStorageKey,
}: {
  left: React.ReactNode;
  right: React.ReactNode;
  sizeStorageKey: string;
  width: number;
}) {
  const maxLeft = Math.max(LEFT_PANEL_MIN, width - RIGHT_PANEL_MIN - DIVIDER_WIDTH);
  const defaultLeft = Math.min(
    maxLeft,
    Math.max(LEFT_PANEL_MIN, (width - DIVIDER_WIDTH) * 0.5)
  );

  const [storedSize, setStoredSize] = useLocalStorageState(sizeStorageKey, defaultLeft);

  return (
    <SplitPanel orientation="horizontal" onResize={setStoredSize}>
      <SplitPanel.Panel
        defaultSize={storedSize}
        minSize={LEFT_PANEL_MIN}
        maxSize={maxLeft}
      >
        {left}
      </SplitPanel.Panel>
      <SplitPanel.Divider />
      <SplitPanel.Panel>{right}</SplitPanel.Panel>
    </SplitPanel>
  );
}

export function ConversationLeftPanel({children}: {children: React.ReactNode}) {
  return (
    <Flex direction="column" flex={1} minHeight="0" overflow="hidden">
      {children}
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
