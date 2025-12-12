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
 * Precomposed layout for Monitors / Alerts edit pages with form handling.
 */
function EditLayout({children, formProps}: WorkflowEngineEditLayoutProps) {
  return (
    <FullHeightForm hideFooter {...formProps}>
      <StyledPage>{children}</StyledPage>
    </FullHeightForm>
  );
}

const StyledPage = styled(Layout.Page)`
  background: ${p => p.theme.tokens.background.primary};
  flex: unset;
`;

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.tokens.background.primary};
`;

const HeaderInner = styled('div')<{maxWidth?: string}>`
  display: contents;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: ${p => p.maxWidth};
    width: 100%;
  }
`;

const StyledBody = styled(Layout.Body)<{maxWidth?: string}>`
  display: flex;
  flex-direction: column;
  gap: ${p => p.theme.space['2xl']};
  padding: 0;
  margin: ${p => p.theme.space.xl};
  max-width: ${p => p.maxWidth};

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: 0;
    margin: ${p =>
      p.noRowGap
        ? `${p.theme.space.xl} ${p.theme.space['3xl']}`
        : `${p.theme.space['2xl']} ${p.theme.space['3xl']}`};
  }
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

function Header({children, noActionWrap, maxWidth}: HeaderProps & {maxWidth?: string}) {
  return (
    <StyledLayoutHeader noActionWrap={noActionWrap}>
      <HeaderInner maxWidth={maxWidth}>{children}</HeaderInner>
    </StyledLayoutHeader>
  );
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

function Body({children, maxWidth}: RequiredChildren & {maxWidth?: string}) {
  return (
    <StyledBody maxWidth={maxWidth}>
      <Layout.Main width="full">{children}</Layout.Main>
    </StyledBody>
  );
}

interface FooterProps extends RequiredChildren {
  label?: string;
  maxWidth?: string;
}

function Footer({children, label, maxWidth}: FooterProps) {
  return (
    <StickyFooter>
      <Flex style={{maxWidth}} align="center" gap="md" justify="end">
        {label && (
          <Text variant="muted" size="md">
            {label}
          </Text>
        )}
        <Flex gap="md" flex={label ? undefined : 1} justify="end">
          {children}
        </Flex>
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
