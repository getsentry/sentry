import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {space} from 'sentry/styles/space';

import {MIN_HEIGHT, MIN_WIDTH, X_GUTTER, Y_GUTTER} from '../common/settings';

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
    >
      <Header noPadding={props.noHeaderPadding}>
        {props.Title && <Fragment>{props.Title}</Fragment>}
        {props.Actions && <TitleHoverItems>{props.Actions}</TitleHoverItems>}
      </Header>

      {props.Visualization && (
        <ErrorBoundary
          customComponent={({error}) => (
            <Widget.WidgetError error={error?.message ?? undefined} />
          )}
        >
          <VisualizationWrapper noPadding={props.noVisualizationPadding}>
            {props.Visualization}
          </VisualizationWrapper>
        </ErrorBoundary>
      )}

      {props.Footer && (
        <FooterWrapper noPadding={props.noFooterPadding}>{props.Footer}</FooterWrapper>
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
  gap: ${space(0.5)};
  margin-left: auto;

  opacity: 1;
  transition: opacity 0.1s;
`;

const Frame = styled('div')<{
  borderless?: boolean;
  height?: number;
  revealActions?: 'always' | 'hover';
}>`
  position: relative;
  display: flex;
  flex-direction: column;

  height: ${p => (p.height ? `${p.height}px` : '100%')};
  min-height: ${MIN_HEIGHT}px;
  width: 100%;
  min-width: ${MIN_WIDTH}px;

  border-radius: ${p => p.theme.borderRadius};
  border: ${p => (p.borderless ? 'none' : `1px solid ${p.theme.border}`)};

  background: ${p => p.theme.background};

  ${p =>
    p.revealActions === 'hover' &&
    css`
      :hover {
        background-color: ${p.theme.surface200};
        transition:
          background-color 100ms linear,
          box-shadow 100ms linear;
        box-shadow: ${p.theme.dropShadowLight};
      }

      &:not(:hover):not(:focus-within) {
        ${TitleHoverItems} {
          opacity: 0;
          ${p.theme.visuallyHidden}
        }
      }
    `}
`;

const Header = styled('div')<{noPadding?: boolean}>`
  display: flex;
  align-items: center;
  height: calc(${HEADER_HEIGHT} + ${Y_GUTTER});
  flex-shrink: 0;
  gap: ${space(0.75)};
  padding: ${p => (p.noPadding ? 0 : `${Y_GUTTER} ${X_GUTTER} 0 ${X_GUTTER}`)};
`;

const VisualizationWrapper = styled('div')<{noPadding?: boolean}>`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  position: relative;
  padding: ${p => (p.noPadding ? 0 : `0 ${X_GUTTER} ${Y_GUTTER} ${X_GUTTER}`)};
`;

const FooterWrapper = styled('div')<{noPadding?: boolean}>`
  margin: 0;
  border-top: 1px solid ${p => p.theme.border};
  padding: ${p => (p.noPadding ? 0 : `${space(1)} ${X_GUTTER} ${space(1)} ${X_GUTTER}`)};
`;
