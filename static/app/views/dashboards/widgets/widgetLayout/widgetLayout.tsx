import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {MIN_HEIGHT, MIN_WIDTH, X_GUTTER, Y_GUTTER} from '../common/settings';

import {Description} from './description';
import {TextTitle} from './textTitle';
import {Toolbar} from './toolbar';

export interface WidgetLayoutProps {
  Actions?: React.ReactNode;
  Footer?: React.ReactNode;
  Title?: React.ReactNode;
  Visualization?: React.ReactNode;
  ariaLabel?: string;
  borderless?: boolean;
  height?: number;
  noFooterPadding?: boolean;
  noHeaderPadding?: boolean;
  noVisualizationPadding?: boolean;
  revealActions?: 'hover' | 'always';
}

function WidgetLayoutComponent(props: WidgetLayoutProps) {
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
        <VisualizationWrapper noPadding={props.noVisualizationPadding}>
          {props.Visualization}
        </VisualizationWrapper>
      )}

      {props.Footer && (
        <FooterWrapper noPadding={props.noFooterPadding}>{props.Footer}</FooterWrapper>
      )}
    </Frame>
  );
}

// `Object.assign` ensures correct types by intersection the component with the
// extra properties. This allows rendering `<WidgetLayout>` as well as
// `<WidgetLayout.Description` and others
const exported = Object.assign(WidgetLayoutComponent, {
  Description,
  TextTitle,
  Toolbar,
});

export {exported as WidgetLayout};

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
