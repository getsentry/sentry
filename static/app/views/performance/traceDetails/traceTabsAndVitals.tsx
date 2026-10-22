import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {TabList, Tabs} from '@sentry/scraps/tabs';

import type {TraceRootEventQueryResults} from 'sentry/views/performance/traceDetails/traceApi/useTraceRootEvent';
import {TraceContextVitals} from 'sentry/views/performance/traceDetails/traceContextVitals';
import {TraceHeaderComponents} from 'sentry/views/performance/traceDetails/traceHeader/styles';
import type {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {TraceLayoutTabsConfig} from 'sentry/views/performance/traceDetails/useTraceLayoutTabs';

type TraceTabsAndVitalsProps = {
  rootEventResults: TraceRootEventQueryResults;
  tabsConfig: TraceLayoutTabsConfig;
  tree: TraceTree;
};

const CONTAINER_MIN_HEIGHT = 36;

function ToolbarLayout(props: FlexProps) {
  return (
    <Flex
      direction={{zero: 'column-reverse', xl: 'row'}}
      justify="between"
      align={{zero: 'start', xl: 'center'}}
      gap="md"
      minHeight={`${CONTAINER_MIN_HEIGHT}px`}
      {...props}
    />
  );
}

function Placeholder() {
  return (
    <ToolbarLayout>
      <Flex align="center" gap="md">
        <TraceHeaderComponents.StyledPlaceholder
          _width={75}
          _height={CONTAINER_MIN_HEIGHT}
        />
        <TraceHeaderComponents.StyledPlaceholder
          _width={75}
          _height={CONTAINER_MIN_HEIGHT}
        />
        <TraceHeaderComponents.StyledPlaceholder
          _width={75}
          _height={CONTAINER_MIN_HEIGHT}
        />
      </Flex>
      <Flex align="center" gap="md">
        <TraceHeaderComponents.StyledPlaceholder _width={100} _height={24} />
        <TraceHeaderComponents.StyledPlaceholder _width={100} _height={24} />
        <TraceHeaderComponents.StyledPlaceholder _width={100} _height={24} />
      </Flex>
    </ToolbarLayout>
  );
}

export function TraceTabsAndVitals({
  tabsConfig,
  rootEventResults,
  tree,
}: TraceTabsAndVitalsProps) {
  const {tabOptions, currentTab, isLoading, onTabChange} = tabsConfig;

  if (isLoading || tree.type === 'loading') {
    return <Placeholder />;
  }

  return (
    <ToolbarLayout>
      <Tabs value={currentTab} onChange={onTabChange}>
        <TabList variant="floating">
          {tabOptions.map(tab => (
            <TabList.Item key={tab.slug}>{tab.label}</TabList.Item>
          ))}
        </TabList>
      </Tabs>
      <TraceContextVitals rootEventResults={rootEventResults} tree={tree} />
    </ToolbarLayout>
  );
}
