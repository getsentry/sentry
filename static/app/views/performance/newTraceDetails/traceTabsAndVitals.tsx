import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {TabList, Tabs} from 'sentry/components/core/tabs';
import {space} from 'sentry/styles/space';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceContextVitals} from 'sentry/views/performance/newTraceDetails/traceContextVitals';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceLayoutTabsConfig} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

type TraceTabsAndVitalsProps = {
  rootEventResults: TraceRootEventQueryResults;
  tabsConfig: TraceLayoutTabsConfig;
  tree: TraceTree;
};

function Placeholder() {
  return (
    <Flex justify="space-between" align="center" gap={space(1)}>
      <Flex align="center" gap={space(1)}>
        <StyledPlaceholder _width={75} _height={28} />
        <StyledPlaceholder _width={75} _height={28} />
        <StyledPlaceholder _width={75} _height={28} />
      </Flex>
      <Flex>
        <StyledPlaceholder _width={100} _height={28} />
        <StyledPlaceholder _width={100} _height={28} />
        <StyledPlaceholder _width={100} _height={28} />
      </Flex>
    </Flex>
  );
}

export function TraceTabsAndVitals({
  tabsConfig,
  rootEventResults,
  tree,
}: TraceTabsAndVitalsProps) {
  const {tabOptions, currentTab, onTabChange} = tabsConfig;
  const containerRef = useRef<HTMLDivElement>(null);
  const resizeObserverRef = useRef<ResizeObserver | null>(null);
  const [containerWidth, setContainerWidth] = useState<number>();

  const onResize = useCallback(() => {
    if (containerRef.current) {
      setContainerWidth(containerRef.current.clientWidth);
    }
  }, []);

  const setRef = useCallback(
    (node: HTMLDivElement | null) => {
      // Clean up old observer if it exists
      if (resizeObserverRef.current && containerRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current);
      }

      containerRef.current = node;

      if (node) {
        resizeObserverRef.current = new ResizeObserver(() => {
          onResize();
        });
        resizeObserverRef.current.observe(node);

        // Trigger on load
        onResize();
      }
    },
    [onResize]
  );

  useEffect(() => {
    return () => {
      // Clean up resize observer on unmount
      if (resizeObserverRef.current && containerRef.current) {
        resizeObserverRef.current.unobserve(containerRef.current);
        resizeObserverRef.current.disconnect();
      }
    };
  }, []);

  if (rootEventResults.isLoading || tree.type === 'loading') {
    return <Placeholder />;
  }

  if (rootEventResults.error || tree.type === 'error') {
    return <Placeholder />;
  }

  return (
    <Flex ref={setRef} justify="space-between">
      <Tabs value={currentTab} onChange={onTabChange}>
        <StyledTabsList hideBorder variant="floating">
          {tabOptions.map(tab => (
            <TabList.Item key={tab.slug}>{tab.label}</TabList.Item>
          ))}
        </StyledTabsList>
      </Tabs>
      <TraceContextVitals
        rootEventResults={rootEventResults}
        tree={tree}
        containerWidth={containerWidth}
      />
    </Flex>
  );
}

const StyledPlaceholder = styled(TraceHeaderComponents.StyledPlaceholder)`
  background-color: ${p => p.theme.purple100};
`;

const StyledTabsList = styled(TabList)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
