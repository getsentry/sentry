import styled from '@emotion/styled';

import emptyStateImg from 'sentry-images/spot/performance-waiting-for-span.svg';

import LoadingIndicator from 'sentry/components/loadingIndicator';
import Panel from 'sentry/components/panels/panel';
import {space} from 'sentry/styles/space';
import * as ModuleLayout from 'sentry/views/insights/common/components/moduleLayout';
import {useHasFirstSpan} from 'sentry/views/insights/common/queries/useHasFirstSpan';
import {useOnboardingProject} from 'sentry/views/insights/common/queries/useOnboardingProject';
import type {ModuleName} from 'sentry/views/insights/types';

export function ModulesOnboarding({
  children,
  moduleName,
  onboardingContent,
}: {
  children: React.ReactNode;
  moduleName: ModuleName;
  onboardingContent: React.ReactNode;
}) {
  const onboardingProject = useOnboardingProject();
  const hasData = useHasFirstSpan(moduleName);

  if (onboardingProject || !hasData) {
    return (
      <ModuleLayout.Full>
        <ModulesOnboardingPanel>{onboardingContent}</ModulesOnboardingPanel>
      </ModuleLayout.Full>
    );
  }
  if (!onboardingProject && hasData) {
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
  width: 260px;
  user-select: none;
  position: absolute;
  bottom: 0;
  right: 0;
  padding-right: ${space(1)};
`;

const Container = styled('div')`
  position: relative;
  overflow: hidden;
  min-height: 160px;
  padding: ${space(4)} ${space(4)} 0;
`;

const ContentContainer = styled('div')`
  position: relative;
  width: 70%;
  z-index: 1;
`;
