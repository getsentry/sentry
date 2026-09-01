import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {HeaderActions} from 'sentry/components/layouts/thirds';
import {
  FullHeightForm,
  FullHeightFormDeprecated,
} from 'sentry/components/workflowEngine/form/fullHeightForm';
import {StickyFooter} from 'sentry/components/workflowEngine/ui/footer';
import type {AvatarProject} from 'sentry/types/project';

interface EditLayoutProps {
  /**
   * The main content for this page
   * Expected to include `<EditLayout.Body>`, `<EditLayout.Header>`, and `<EditLayout.Footer>` components.
   */
  children: React.ReactNode;
}

function EditLayoutComponent({children}: EditLayoutProps) {
  return (
    <FullHeightForm>
      <Stack flex="unset">{children}</Stack>
    </FullHeightForm>
  );
}

interface EditLayoutDeprecatedProps {
  children: React.ReactNode;
  formProps: React.ComponentProps<typeof FullHeightFormDeprecated>;
}

// Wraps the children in the legacy form component.
// Remove once all detector forms have migrated to the new form system.
function EditLayoutDeprecatedComponent({children, formProps}: EditLayoutDeprecatedProps) {
  return (
    <FullHeightFormDeprecated hideFooter {...formProps}>
      <Stack flex="unset">{children}</Stack>
    </FullHeightFormDeprecated>
  );
}

const StyledLayoutHeader = styled(Layout.Header)`
  background-color: ${p => p.theme.tokens.background.primary};
`;

const HeaderInner = styled('div')<{maxWidth?: string}>`
  display: contents;

  @container (min-width: ${p => p.theme.container['3xl']}) {
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    max-width: ${p => p.maxWidth};
    width: 100%;
  }
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
    <Stack gap="md">
      <Layout.Title>{title}</Layout.Title>
      {project && <ProjectBadge project={project} disableLink avatarSize={16} />}
    </Stack>
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
  return (
    <Stack gap="md" column="1 / -1">
      {children}
    </Stack>
  );
}

function Body({children, maxWidth}: RequiredChildren & {maxWidth?: string}) {
  return (
    <Stack
      flexGrow={1}
      gap="2xl"
      background="primary"
      padding="0"
      margin={{zero: 'xl', '3xl': '2xl 3xl'}}
      maxWidth={maxWidth}
    >
      <Layout.Main width="full">{children}</Layout.Main>
    </Stack>
  );
}

interface FooterProps extends RequiredChildren {
  label?: string;
  maxWidth?: string;
}

function Footer({children, label, maxWidth}: FooterProps) {
  return (
    <StickyFooter>
      <Flex maxWidth={maxWidth} align="center" gap="md" justify="end">
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

export const EditLayout = Object.assign(EditLayoutComponent, {
  Body,
  Footer,
});

/**
 * This component is for forms still using the legacy `FormModel` system.
 * Remove once all detector forms have migrated to the new form system.
 */
export const EditLayoutDeprecated = Object.assign(EditLayoutDeprecatedComponent, {
  Header,
  HeaderContent,
  Actions,
  HeaderFields,
  Body,
  Footer,
  Title,
});
