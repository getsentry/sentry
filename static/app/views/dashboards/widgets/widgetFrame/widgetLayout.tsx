import {Fragment} from 'react';
import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

import {MIN_HEIGHT, MIN_WIDTH, X_GUTTER, Y_GUTTER} from '../common/settings';

export interface WidgetLayoutProps {
  Actions?: React.ReactNode;
  Title?: React.ReactNode;
  Visualization?: React.ReactNode;
  ariaLabel?: string;
}

export function WidgetLayout(props: WidgetLayoutProps) {
  return (
    <Frame aria-label={props.ariaLabel}>
      <Header>
        {props.Title && <Fragment>{props.Title}</Fragment>}
        {props.Actions && <TitleHoverItems>{props.Actions}</TitleHoverItems>}
      </Header>

      {props.Visualization && (
        <VisualizationWrapper>{props.Visualization}</VisualizationWrapper>
      )}
    </Frame>
  );
}

const HEADER_HEIGHT = '26px';

const TitleHoverItems = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.5)};
  margin-left: auto;

  opacity: 1;
  transition: opacity 0.1s;
`;

const Frame = styled('div')`
  position: relative;
  display: flex;
  flex-direction: column;

  height: 100%;
  min-height: ${MIN_HEIGHT}px;
  width: 100%;
  min-width: ${MIN_WIDTH}px;

  border-radius: ${p => p.theme.panelBorderRadius};
  border: 1px solid ${p.theme.border};

  background: ${p => p.theme.background};

  :hover {
    background-color: ${p => p.theme.surface200};
    transition:
      background-color 100ms linear,
      box-shadow 100ms linear;
    box-shadow: ${p => p.theme.dropShadowLight};
  }

  &:not(:hover):not(:focus-within) {
    ${TitleHoverItems} {
      opacity: 0;
      ${p => p.theme.visuallyHidden}
    }
  }
`;

const Header = styled('div')`
  display: flex;
  align-items: center;
  height: calc(${HEADER_HEIGHT} + ${Y_GUTTER});
  flex-shrink: 0;
  gap: ${space(0.75)};
  padding: ${X_GUTTER} ${Y_GUTTER} 0 ${X_GUTTER};
`;

const VisualizationWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  flex-grow: 1;
  min-height: 0;
  position: relative;
`;
