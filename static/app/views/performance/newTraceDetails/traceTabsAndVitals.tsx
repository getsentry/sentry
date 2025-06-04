import {useCallback, useEffect, useRef, useState} from 'react';
import styled from '@emotion/styled';

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
    <Container>
      <FlexBox>
        <StyledPlaceholder _width={75} _height={28} />
        <StyledPlaceholder _width={75} _height={28} />
        <StyledPlaceholder _width={75} _height={28} />
      </FlexBox>
      <FlexBox>
        <StyledPlaceholder _width={100} _height={28} />
        <StyledPlaceholder _width={100} _height={28} />
        <StyledPlaceholder _width={100} _height={28} />
      </FlexBox>
    </Container>
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
    <Container ref={setRef}>
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
    </Container>
  );
}

const StyledPlaceholder = styled(TraceHeaderComponents.StyledPlaceholder)`
  background-color: ${p => p.theme.purple100};
`;

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const Container = styled(FlexBox)`
  justify-content: space-between;
`;

const StyledTabsList = styled(TabList)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
