import {Flex, type FlexProps} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {Placeholder} from 'sentry/components/placeholder';

import type {TraceRootEventQueryResults} from './traceApi/useTraceRootEvent';
import type {TraceTree} from './traceModels/traceTree';
import {TraceContextVitals} from './traceContextVitals';
import type {TraceLayoutTabsConfig} from './useTraceLayoutTabs';

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

function TabsAndVitalsPlaceholder() {
  return (
    <ToolbarLayout>
      <Flex align="center" gap="md">
        <Placeholder width="75px" height={`${CONTAINER_MIN_HEIGHT}px`} />
        <Placeholder width="75px" height={`${CONTAINER_MIN_HEIGHT}px`} />
        <Placeholder width="75px" height={`${CONTAINER_MIN_HEIGHT}px`} />
      </Flex>
      <Flex align="center" gap="md">
        <Placeholder width="100px" height="24px" />
        <Placeholder width="100px" height="24px" />
        <Placeholder width="100px" height="24px" />
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
    return <TabsAndVitalsPlaceholder />;
  }

  return (
    <ToolbarLayout>
      <Tabs value={currentTab} onChange={onTabChange}>
        {({TabList}) => (
          <TabList variant="floating">
            {tabOptions.map(tab => (
              <TabList.Item key={tab.slug}>{tab.label}</TabList.Item>
            ))}
          </TabList>
        )}
      </Tabs>
      <TraceContextVitals rootEventResults={rootEventResults} tree={tree} />
    </ToolbarLayout>
  );
}
