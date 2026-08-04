import {Fragment} from 'react';

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

interface RequiredChildren {
  children: React.ReactNode;
}

function Body({children}: RequiredChildren) {
  return <Layout.Body gap="2xl">{children}</Layout.Body>;
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
  Body,
  Main,
  Sidebar,
  Title,
});
