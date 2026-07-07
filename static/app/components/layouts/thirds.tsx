import {type HTMLAttributes} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {
  Container,
  Stack,
  type FlexProps,
  type ContainerProps,
} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {TopBar} from 'sentry/views/navigation/topBar';

/**
 * Main container for a page.
 */
export function Page(props: FlexProps<'main'>) {
  return <Stack as="main" flex="1" background="primary" {...props} />;
}

/**
 * Header container for header content and header actions.
 *
 * Uses a horizontal layout in wide viewports to put space between
 * the headings and the actions container. In narrow viewports these elements
 * are stacked vertically.
 *
 * Use `noActionWrap` to disable wrapping if there are minimal actions.
 */
export const Header = styled((props: ContainerProps<'header'>) => {
  return (
    <Container
      padding={{'screen:sm': 'md lg 0 lg', 'screen:md': 'lg xl 0 xl'}}
      {...props}
    />
  );
})<{
  borderStyle?: 'dashed' | 'solid';
  noActionWrap?: boolean;
  /**
   * Whether to use the unified header variant. Unified headers have the
   * same background color as the main content area and no border, thus
   * "unifying" the two areas.
   */
  unified?: boolean;
}>`
  display: grid;
  grid-template-columns: ${p =>
    p.noActionWrap ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)'};

  ${p =>
    !p.unified &&
    css`
      border-bottom: 1px ${p.borderStyle ?? 'solid'} ${p.theme.tokens.border.primary};
    `}

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: minmax(0, 1fr) auto;
  }
`;

/**
 * Use HeaderContent to create horizontal regions in the header
 * that contain a heading/breadcrumbs and a button group.
 */
export const HeaderContent = styled('div')<{unified?: boolean}>`
  display: flex;
  flex-direction: column;
  justify-content: normal;
  margin-bottom: ${p => (p.unified ? 0 : p.theme.space.md)};
  max-width: 100%;
`;

/**
 * Container for action buttons and secondary information that
 * flows on the top right of the header.
 */
export const HeaderActions = styled('div')`
  display: flex;
  flex-direction: column;
  justify-content: normal;
  min-width: max-content;
  margin-top: ${p => p.theme.space['2xs']};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    width: max-content;
    margin-bottom: ${p => p.theme.space.xl};
  }

  @media (max-width: ${p => p.theme.breakpoints.sm}) {
    width: 100%;
    min-width: 100%;
    max-width: 100%;
  }
`;

export function Title(props: {children: React.ReactNode}) {
  return <TopBar.Slot name="title">{props.children}</TopBar.Slot>;
}

/**
 * Styled Tabs for use inside a Layout.Header component
 */
export const HeaderTabs = styled(Tabs)`
  grid-column: 1 / -1;
` as typeof Tabs;

/**
 * Base container for 66/33 containers.
 */
export const Body = styled((props: ContainerProps & {noRowGap?: boolean}) => {
  return (
    <Container as="div" margin="0" background="primary" padding="lg xl" {...props} />
  );
})<{noRowGap?: boolean}>`
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: grid;
    grid-template-columns: minmax(100px, auto) 325px;
    align-content: start;
    gap: ${p => (p.noRowGap ? `0 ${p.theme.space['2xl']}` : p.theme.space['2xl'])};
  }
`;

interface MainProps extends HTMLAttributes<HTMLElement> {
  children: React.ReactNode;
  /**
   * Set the width of the main content.
   * - 'twothirds': The main content will span the left two-thirds of the Body. Use this for layouts with a side column.
   * - 'full': The main content will span the width of the container. Use when the layout does not have a side column.
   * - 'full-constrained': The main content will span the width of the container and wrapped in a 1440px wide container.
   * Defaults to 'twothirds'.
   */
  width?: 'twothirds' | 'full' | 'full-constrained';
}

/**
 * Containers for left column of the 66/33 layout.
 */
export function Main({children, width = 'twothirds', ...props}: MainProps) {
  // We need the extra DOM element when the width is constrained because Main is a part of a grid layout.
  // If we apply the max width directly the right end of the page background will be missing
  return (
    <Container
      column={width === 'twothirds' ? '1/2' : '1/3'}
      as="section"
      width="100%"
      {...props}
    >
      {width === 'full-constrained' ? (
        <Container maxWidth="1440px">{children}</Container>
      ) : (
        children
      )}
    </Container>
  );
}

/**
 * Container for the right column the 66/33 layout
 */
export function Side(props: ContainerProps<'aside'>) {
  return <Container as="aside" column="2/3" {...props} />;
}
