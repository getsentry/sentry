import styled from '@emotion/styled';

import {TabList, Tabs} from 'sentry/components/tabs';
import {space} from 'sentry/styles/space';
import {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {TraceLayoutTabsConfig} from 'sentry/views/performance/newTraceDetails/useTraceLayoutTabs';

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

  if (rootEventResults.isLoading || tree.type === 'loading') {
    return <Placeholder />;
  }

  if (rootEventResults.error || tree.type === 'error') {
    return <Placeholder />;
  }

  return (
    <Container>
      <Tabs value={currentTab} onChange={onTabChange}>
        <StyledTabsList hideBorder variant="floating">
          {tabOptions.map(tab => (
            <TabList.Item key={tab.slug}>{tab.label}</TabList.Item>
          ))}
        </StyledTabsList>
      </Tabs>
      <div>TODO: Vitals</div>
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
  container-type: inline-size;
`;

const StyledTabsList = styled(TabList)`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;
