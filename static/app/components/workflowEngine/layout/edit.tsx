import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Text} from 'sentry/components/core/text/text';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {HeaderActions} from 'sentry/components/layouts/thirds';
import {FullHeightForm} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import {space} from 'sentry/styles/space';
import type {AvatarProject} from 'sentry/types/project';

interface WorkflowEngineEditLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<EditLayout.Body>`, `<EditLayout.Header>`, and `<EditLayout.Footer>` components.
   */
  children: React.ReactNode;
  formProps?: React.ComponentProps<typeof FullHeightForm>;
}

/**
 * Precomposed layout for Automations / Monitors edit pages with form handling.
 */
function EditLayout({children, formProps}: WorkflowEngineEditLayoutProps) {
  return (
    <FullHeightForm hideFooter {...formProps}>
      <StyledPage>{children}</StyledPage>
    </FullHeightForm>
  );
}

const StyledPage = styled(Layout.Page)`
  background: ${p => p.theme.background};
  flex: unset;
`;

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.background};
`;

const StyledBody = styled(Layout.Body)`
  display: flex;
  flex-direction: column;
  gap: ${space(3)};
`;

const FullWidthContent = styled('div')`
  grid-column: 1 / -1;
  display: flex;
  flex-direction: column;
  gap: ${space(2)};
`;

interface RequiredChildren {
  children: React.ReactNode;
}

interface HeaderProps extends RequiredChildren {
  noActionWrap?: boolean;
}

function Header({children, noActionWrap}: HeaderProps) {
  return <StyledLayoutHeader noActionWrap={noActionWrap}>{children}</StyledLayoutHeader>;
}

function HeaderContent({children}: RequiredChildren) {
  return <Layout.HeaderContent>{children}</Layout.HeaderContent>;
}

function Title({title, project}: {title: string; project?: AvatarProject}) {
  return (
    <Flex direction="column" gap="md">
      <Layout.Title>{title}</Layout.Title>
      {project && <ProjectBadge project={project} disableLink avatarSize={16} />}
    </Flex>
  );
}

function Actions({children}: RequiredChildren) {
  return (
    <HeaderActions>
      <Flex gap="sm">{children}</Flex>
    </HeaderActions>
  );
}

function HeaderFields({children}: RequiredChildren) {
  return <FullWidthContent>{children}</FullWidthContent>;
}

function Body({children}: RequiredChildren) {
  return (
    <StyledBody>
      <Layout.Main fullWidth>{children}</Layout.Main>
    </StyledBody>
  );
}

interface FooterProps extends RequiredChildren {
  label?: string;
}

function Footer({children, label}: FooterProps) {
  return (
    <StickyFooter>
      {label && <Text size="md">{label}</Text>}
      <Flex gap="md" flex={label ? undefined : 1} justify="end">
        {children}
      </Flex>
    </StickyFooter>
  );
}

const WorkflowEngineEditLayout = Object.assign(EditLayout, {
  Header,
  HeaderContent,
  Actions,
  HeaderFields,
  Body,
  Footer,
  Title,
});

export default WorkflowEngineEditLayout;
