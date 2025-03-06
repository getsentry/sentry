import styled from '@emotion/styled';

import Panel from 'sentry/components/panels/panel';
import {WidgetCardContextMenuContainer} from 'sentry/views/dashboards/widgetCard/widgetCardContextMenuContainer';

export const WidgetCardPanel = styled(Panel, {
  shouldForwardProp: prop => prop !== 'isDragging',
})<{
  isDragging: boolean;
}>`
  margin: 0;
  visibility: ${p => (p.isDragging ? 'hidden' : 'visible')};
  /* If a panel overflows due to a long title stretch its grid sibling */
  height: 100%;
  min-height: 96px;
  display: flex;
  flex-direction: column;

  &:not(:hover):not(:focus-within) {
    ${WidgetCardContextMenuContainer} {
      opacity: 0;
      ${p => p.theme.visuallyHidden}
    }
  }

  :hover {
    background-color: ${p => p.theme.surface200};
    transition:
      background-color 100ms linear,
      box-shadow 100ms linear;
    box-shadow: ${p => p.theme.dropShadowLight};
  }
`;
