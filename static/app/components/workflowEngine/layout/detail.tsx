import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
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
function DetailLayoutComponent({children}: WorkflowEngineDetailLayoutProps) {
  return <Stack flex={1}>{children}</Stack>;
}

const StyledBody = styled(Layout.Body)`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xl']};
`;

interface RequiredChildren {
  children: React.ReactNode;
}
function Main({children}: RequiredChildren) {
  return (
    <Layout.Main>
      <Stack gap="xl">{children}</Stack>
    </Layout.Main>
  );
}
function Sidebar({children}: RequiredChildren) {
  return (
    <Layout.Side>
      <Stack gap="xl">{children}</Stack>
    </Layout.Side>
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

export const DetailLayout = Object.assign(DetailLayoutComponent, {
  Body: StyledBody,
  Main,
  Sidebar,
  Title,
});
