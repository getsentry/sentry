import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {defined} from 'sentry/utils';
import {MIN_HEIGHT, MIN_WIDTH} from 'sentry/views/dashboards/widgets/common/settings';

import {WidgetDescription} from './widgetDescription';
import {WidgetError} from './widgetError';
import {WidgetTitle} from './widgetTitle';
import {WidgetToolbar} from './widgetToolbar';

export interface Widget {
  /**
   * Placed in the top right of the frame
   */
  Actions?: React.ReactNode;
  /**
   * Placed below the visualization, inside the frame
   */
  Footer?: React.ReactNode;
  /**
   * Placed in the top left of the frame
   */
  Title?: React.ReactNode;
  /**
   * Placed to the immediate right of the title
   */
  TitleBadges?: React.ReactNode;
  /**
   * Placed in the main area of the frame
   */
  Visualization?: React.ReactNode;
  ariaLabel?: string;
  /**
   * Removes frame border
   */
  borderless?: boolean;
  /**
   * Height in pixels. If omitted, the widget grows to fill the parent element. Avoid this! Setting the height via the parent element is more robust
   */
  height?: number;
  /**
   * Removes padding from the footer area
   */
  noFooterPadding?: boolean;
  /**
   * Removes padding from the header area
   */
  noHeaderPadding?: boolean;
  /**
   * Removes padding from the visualization area
   */
  noVisualizationPadding?: boolean;
  /**
   * If set to `"hover"`, the contents of the `Actions` slot are only shown on mouseover. If set to `"always"`, the contents of `Actions` are always shown
   */
  revealActions?: 'hover' | 'always';
}

function WidgetLayout(props: Widget) {
  const {revealActions = 'hover'} = props;

  return (
    <Frame
      aria-label={props.ariaLabel}
      height={props.height}
      borderless={props.borderless}
      revealActions={revealActions}
      minHeight={defined(props.height) ? Math.min(props.height, MIN_HEIGHT) : MIN_HEIGHT}
    >
      <Header noPadding={props.noHeaderPadding}>
        {props.Title && <Fragment>{props.Title}</Fragment>}
        {props.TitleBadges && (
          <Flex align="center" gap="xs">
            {props.TitleBadges}
          </Flex>
        )}
        {props.Actions && <TitleHoverItems>{props.Actions}</TitleHoverItems>}
      </Header>

      {props.Visualization && (
        <VisualizationWrapper noPadding={props.noVisualizationPadding}>
          <ErrorBoundary
            customComponent={({error}) => (
              <Container position="absolute" inset={0}>
                <WidgetError error={error ?? undefined} />
              </Container>
            )}
          >
            {props.Visualization}
          </ErrorBoundary>
        </VisualizationWrapper>
      )}

      {props.Footer && (
        <FooterWrapper noPadding={props.noFooterPadding}>
          <ErrorBoundary
            customComponent={({error}) => <WidgetError error={error ?? undefined} />}
          >
            {props.Footer}
          </ErrorBoundary>
        </FooterWrapper>
      )}
    </Frame>
  );
}

// `Object.assign` ensures correct types by intersection the component with the
// extra properties. This allows rendering `<Widget>` as well as
// `<Widget.Description` and others
const exported = Object.assign(WidgetLayout, {
  WidgetDescription,
  WidgetTitle,
  WidgetToolbar,
  WidgetError,
});

export {exported as Widget};

const HEADER_HEIGHT = '26px';

const TitleHoverItems = styled('div')`
  display: flex;
  align-items: center;
  gap: ${p => p.theme.space.xs};
  margin-left: auto;

  opacity: 1;
  transition: opacity 0.1s;
`;

const Frame = styled('div')<{
  borderless?: boolean;
  height?: number;
  minHeight?: number;
  revealActions?: 'always' | 'hover';
}>`
  position: relative;
  display: flex;
  flex-direction: column;

  height: ${p => (p.height ? `${p.height}px` : '100%')};
  min-height: ${p => p.minHeight}px;
  width: 100%;
  min-width: ${MIN_WIDTH}px;

  border-radius: ${p => p.theme.radius.md};
  border: ${p => (p.borderless ? 'none' : `1px solid ${p.theme.tokens.border.primary}`)};

  background: ${p => p.theme.tokens.background.primary};

  ${p =>
    p.revealActions === 'hover' &&
    css`
      &:not(:hover):not(:focus-within) {
        ${TitleHoverItems} {
          opacity: 0;
          ${p.theme.visuallyHidden}
        }
      }
    `}
`;

export const Header = styled('div')<{noPadding?: boolean}>`
  display: flex;
  align-items: center;
  height: calc(${HEADER_HEIGHT} + ${p => p.theme.space.lg});
  flex-shrink: 0;
  gap: ${p => p.theme.space.sm};
  padding: ${p =>
    p.noPadding ? 0 : `${p.theme.space.lg} ${p.theme.space.xl} 0 ${p.theme.space.xl}`};
`;

const VisualizationWrapper = styled('div')<{noPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  position: relative;
  padding: ${p =>
    p.noPadding ? 0 : `0 ${p.theme.space.xl} ${p.theme.space.lg} ${p.theme.space.xl}`};
`;

export const FooterWrapper = styled('div')<{noPadding?: boolean}>`
  margin: 0;
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  padding: ${p =>
    p.noPadding
      ? 0
      : `${p.theme.space.md} ${p.theme.space.xl} ${p.theme.space.md} ${p.theme.space.xl}`};
`;
