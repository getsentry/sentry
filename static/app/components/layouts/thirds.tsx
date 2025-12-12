import type {HTMLAttributes} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {Tabs} from 'sentry/components/core/tabs';
import {space} from 'sentry/styles/space';

/**
 * Main container for a page.
 */
export const Page = styled('main')<{withPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  flex: 1;
  ${p => p.withPadding && `padding: ${space(3)} ${space(4)}`};
`;

/**
 * Header container for header content and header actions.
 *
 * Uses a horizontal layout in wide viewports to put space between
 * the headings and the actions container. In narrow viewports these elements
 * are stacked vertically.
 *
 * Use `noActionWrap` to disable wrapping if there are minimal actions.
 */
export const Header = styled('header')<{
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

  padding: ${space(2)} ${space(2)} 0 ${space(2)};
  background-color: ${p => p.theme.tokens.background.primary};

  ${p =>
    !p.unified &&
    css`
      border-bottom: 1px ${p.borderStyle ?? 'solid'} ${p.theme.border};
    `}

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)} ${space(4)} 0 ${space(4)};
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
  margin-bottom: ${space(1)};
  max-width: 100%;

  ${p =>
    p.unified &&
    css`
      margin-bottom: 0;
    `}
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
  margin-top: ${space(0.25)};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    width: max-content;
    margin-bottom: ${space(2)};
  }
`;

/**
 * Heading title
 *
 * Includes flex gap for additional items placed with the text (such as feature
 * badges or ID badges)
 */
export const Title = styled('h1')<{withMargins?: boolean}>`
  ${p => p.theme.overflowEllipsis};
  font-size: 1.625rem;
  font-weight: 600;
  letter-spacing: -0.01em;
  margin: 0;
  color: ${p => p.theme.tokens.content.primary};
  margin-bottom: ${p => p.withMargins && space(3)};
  margin-top: ${p => p.withMargins && space(1)};
  line-height: 40px;

  display: flex;
  gap: ${space(1)};
  align-items: center;
`;

/**
 * Styled Tabs for use inside a Layout.Header component
 */
export const HeaderTabs = styled(Tabs)`
  grid-column: 1 / -1;
` as typeof Tabs;

/**
 * Base container for 66/33 containers.
 */
export const Body = styled('div')<{noRowGap?: boolean}>`
  padding: ${space(2)};
  margin: 0;
  background-color: ${p => p.theme.tokens.background.primary};
  flex-grow: 1;

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    padding: ${p => (p.noRowGap ? `${space(2)} ${space(4)}` : `${space(3)} ${space(4)}`)};
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    display: grid;
    grid-template-columns: minmax(100px, auto) 325px;
    align-content: start;
    gap: ${p => (p.noRowGap ? `0 ${space(3)}` : `${space(3)}`)};
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
export const Side = styled('aside')`
  grid-column: 2/3;
`;
