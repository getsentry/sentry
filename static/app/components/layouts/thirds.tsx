import styled from '@emotion/styled';

import {
  Container,
  Grid,
  Stack,
  type ContainerProps,
  type GridProps,
} from '@sentry/scraps/layout';
import {Tabs} from '@sentry/scraps/tabs';

import {TopBar} from 'sentry/views/navigation/topBar';

/**
 * Main container for a page.
 */
export function Page(props: {children: React.ReactNode}) {
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
type HeaderProps = {
  children: React.ReactNode;
  noActionWrap?: boolean;
  /**
   * Whether to use the unified header variant. Unified headers have the
   * same background color as the main content area and no border, thus
   * "unifying" the two areas.
   */
  unified?: boolean;
};

export function Header({noActionWrap, unified, ...props}: HeaderProps) {
  return (
    <Grid
      as="header"
      columns={{
        zero: noActionWrap ? 'minmax(0, 1fr) auto' : 'minmax(0, 1fr)',
        '3xl': 'minmax(0, 1fr) auto',
      }}
      padding={{zero: 'md lg 0 lg', '3xl': 'lg xl 0 xl'}}
      borderBottom={unified ? 'none' : 'primary'}
      {...props}
    />
  );
}

/**
 * Use HeaderContent to create horizontal regions in the header
 * that contain a heading/breadcrumbs and a button group.
 */
export function HeaderContent(props: {children: React.ReactNode}) {
  return <Stack justify="start" marginBottom="md" maxWidth="100%" {...props} />;
}

/**
 * Container for action buttons and secondary information that
 * flows on the top right of the header.
 */
export function HeaderActions(props: {children: React.ReactNode}) {
  return (
    <Stack
      justify="start"
      width={{zero: '100%', xl: 'max-content', '3xl': 'auto'}}
      minWidth={{zero: '100%', xl: 'max-content'}}
      maxWidth={{zero: '100%', xl: 'none'}}
      marginTop="2xs"
      marginBottom={{zero: 'xl', '3xl': '0'}}
      {...props}
    />
  );
}

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
type BodyProps = GridProps & {noRowGap?: boolean};

export function Body({noRowGap, ...props}: BodyProps) {
  return (
    <Grid
      flexGrow={1}
      columns={{zero: 'minmax(0, 1fr)', '4xl': 'minmax(100px, auto) 325px'}}
      alignContent="start"
      gap={noRowGap ? '0 2xl' : '2xl'}
      background="primary"
      padding="lg xl"
      {...props}
    />
  );
}

interface MainProps extends ContainerProps<'section'> {
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
      column={{
        zero: '1 / -1',
        '4xl': width === 'twothirds' ? '1/2' : '1/3',
      }}
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
  return <Container as="aside" column={{zero: '1 / -1', '4xl': '2/3'}} {...props} />;
}
