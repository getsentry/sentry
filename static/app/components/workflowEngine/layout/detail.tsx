import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {HeaderActions} from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

interface WorkflowEngineDetailLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<DetailLayout.Body>` and `<DetailLayout.Header>` components.
   */
  children: React.ReactNode;
}

/**
 * Precomposed 67/33 layout for Monitors / Alerts detail pages.
 */
function DetailLayout({children}: WorkflowEngineDetailLayoutProps) {
  return <StyledPage>{children}</StyledPage>;
}

const StyledPage = styled(Layout.Page)`
  background: ${p => p.theme.tokens.background.primary};
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
      <Flex direction="column" gap="xl">
        {children}
      </Flex>
    </Layout.Main>
  );
}
function Sidebar({children}: RequiredChildren) {
  return (
    <Layout.Side>
      <Flex direction="column" gap="xl">
        {children}
      </Flex>
    </Layout.Side>
  );
}

function Header({children}: RequiredChildren) {
  return <Layout.Header>{children}</Layout.Header>;
}

function HeaderContent({children}: RequiredChildren) {
  return <Layout.HeaderContent>{children}</Layout.HeaderContent>;
}

function Actions({children}: RequiredChildren) {
  return (
    <HeaderActions>
      <Flex gap="md">{children}</Flex>
    </HeaderActions>
  );
}

function Title({title, project}: {title: string; project?: AvatarProject}) {
  return (
    <Fragment>
      <Layout.Title>{title}</Layout.Title>
      {project && (
        <Flex align="center" padding="md 0">
          <ProjectBadge project={project} disableLink avatarSize={16} />
        </Flex>
      )}
    </Fragment>
  );
}

const WorkflowEngineDetailLayout = Object.assign(DetailLayout, {
  Body: StyledBody,
  Main,
  Sidebar,
  Header,
  HeaderContent,
  Actions,
  Title,
});

export default WorkflowEngineDetailLayout;
