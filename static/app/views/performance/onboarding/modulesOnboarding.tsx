import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import {useOnboardingProject} from 'sentry/views/performance/browser/webVitals/utils/useOnboardingProject';
import * as ModuleLayout from 'sentry/views/performance/moduleLayout';
import {useHasData} from 'sentry/views/performance/onboarding/useHasData';

export function ModulesOnboarding({
  children,
  moduleQueryFilter,
  onboardingContent,
  referrer,
}: {
  children: React.ReactNode;
  moduleQueryFilter: string;
  onboardingContent: React.ReactNode;
  referrer: string;
}) {
  const onboardingProject = useOnboardingProject();
  const {hasData, isLoading} = useHasData(moduleQueryFilter, referrer);

  if (onboardingProject || (!hasData && !isLoading)) {
    return (
      <ModuleLayout.Full>
        <ModulesOnboardingPanel>{onboardingContent}</ModulesOnboardingPanel>
      </ModuleLayout.Full>
    );
  }
  if (!onboardingProject && hasData && !isLoading) {
    return children;
  }
  // TODO: Add an error state?
  return (
    <ModuleLayout.Full>
      <LoadingIndicator />
    </ModuleLayout.Full>
  );
}

function ModulesOnboardingPanel({children}: {children: React.ReactNode}) {
  return (
    <Panel>
      <Container>
        <ContentContainer>{children}</ContentContainer>
        <PerfImage src={emptyStateImg} />
      </Container>
    </Panel>
  );
}

const PerfImage = styled('img')`
  -webkit-transform: scaleX(-1);
  transform: scaleX(-1);
  width: 600px;
  user-select: none;
  position: absolute;
  bottom: 0;
  right: 0;
`;

const Container = styled('div')`
  position: relative;
  overflow: hidden;
  min-height: 160px;
  padding: ${space(4)} ${space(4)} 0;
`;

const ContentContainer = styled('div')`
  position: relative;
  z-index: 1;
`;
