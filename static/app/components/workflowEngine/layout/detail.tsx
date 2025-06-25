import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import * as Layout from 'sentry/components/layouts/thirds';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {ActionsFromContext} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsFromContext} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import {space} from 'sentry/styles/space';
import {DetectorSubtitle} from 'sentry/views/detectors/components/detectorSubtitle';

interface WorkflowEngineDetailLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<DetailLayout.Main>` and `<DetailLayout.Sidebar>` components.
   */
  children: React.ReactNode;
  environment: string | undefined;
  projectId: string | undefined;
}

/**
 * Precomposed 67/33 layout for Automations / Monitors detail pages.
 */
function DetailLayout({
  children,
  projectId,
  environment,
}: WorkflowEngineDetailLayoutProps) {
  const title = useDocumentTitle();
  return (
    <StyledPage>
      <Layout.Header unified>
        <Layout.HeaderContent>
          <BreadcrumbsFromContext />
          <Layout.Title>{title}</Layout.Title>
          <DetectorSubtitle projectId={projectId} environment={environment} />
        </Layout.HeaderContent>
        <ActionsFromContext />
      </Layout.Header>
      <StyledBody>{children}</StyledBody>
    </StyledPage>
  );
}

const StyledPage = styled(Layout.Page)`
  background: ${p => p.theme.background};
`;

const StyledBody = styled(Layout.Body)`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

interface RequiredChildren {
  children: React.ReactNode;
}
function Main({children}: RequiredChildren) {
  return (
    <Layout.Main>
      <Flex direction="column" gap={space(2)}>
        {children}
      </Flex>
    </Layout.Main>
  );
}
function Sidebar({children}: RequiredChildren) {
  return (
    <Layout.Side>
      <Flex direction="column" gap={space(2)}>
        {children}
      </Flex>
    </Layout.Side>
  );
}

const WorkflowEngineDetailLayout = Object.assign(DetailLayout, {Main, Sidebar});

export default WorkflowEngineDetailLayout;
