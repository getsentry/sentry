import styled from '@emotion/styled';

import {Flex} from 'sentry/components/container/flex';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {useDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {ActionsFromContext} from 'sentry/components/workflowEngine/layout/actions';
import {BreadcrumbsFromContext} from 'sentry/components/workflowEngine/layout/breadcrumbs';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import useProjectFromSlug from 'sentry/utils/useProjectFromSlug';

export interface WorkflowEngineDetailLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<DetailLayout.Main>` and `<DetailLayout.Sidebar>` components.
   */
  children: React.ReactNode;
}

/**
 * Precomposed 67/33 layout for Automations / Monitors detail pages.
 */
function DetailLayout({children}: WorkflowEngineDetailLayoutProps) {
  const title = useDocumentTitle();
  const organization = useOrganization({allowNull: false});
  const project = useProjectFromSlug({organization, projectSlug: 'javascript'});
  return (
    <StyledPage>
      <Layout.Header>
        <Layout.HeaderContent>
          <BreadcrumbsFromContext />
          <Layout.Title>{title}</Layout.Title>
          <ProjectContainer>
            {!project ? (
              <LoadingIndicator />
            ) : (
              <ProjectBadge project={project} disableLink avatarSize={16} />
            )}
          </ProjectContainer>
        </Layout.HeaderContent>
        <ActionsFromContext />
      </Layout.Header>
      <StyledBody>{children}</StyledBody>
    </StyledPage>
  );
}

const ProjectContainer = styled('div')`
  margin-top: ${space(1)};
  font-size: ${p => p.theme.fontSizeMedium};
`;

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
      <Flex column gap={space(2)}>
        {children}
      </Flex>
    </Layout.Main>
  );
}
function Sidebar({children}: RequiredChildren) {
  return (
    <Layout.Side>
      <Flex column gap={space(2)}>
        {children}
      </Flex>
    </Layout.Side>
  );
}

const WorkflowEngineDetailLayout = Object.assign(DetailLayout, {Main, Sidebar});

export default WorkflowEngineDetailLayout;
