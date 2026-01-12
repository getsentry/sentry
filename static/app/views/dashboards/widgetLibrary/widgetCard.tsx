import styled from '@emotion/styled';

import {IconArrow, IconGraph, IconMenu, IconNumber} from 'sentry/icons';
import {IconGraphArea} from 'sentry/icons/iconGraphArea';
import {IconGraphBar} from 'sentry/icons/iconGraphBar';
import {DisplayType} from 'sentry/views/dashboards/types';

export function getWidgetIcon(displayType: DisplayType): React.ReactNode {
  switch (displayType) {
    case DisplayType.TABLE:
      return <StyledIconMenu />;
    case DisplayType.BIG_NUMBER:
      return <StyledIconNumber />;
    case DisplayType.BAR:
      return <StyledIconGraphBar />;
    case DisplayType.TOP_N:
      return <StyledIconArrow />;
    case DisplayType.AREA:
      return <StyledIconGraphArea />;
    case DisplayType.LINE:
    default:
      return <StyledIconGraph />;
  }
}

const StyledIconMenu = styled(IconMenu)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconNumber = styled(IconNumber)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconGraphBar = styled(IconGraphBar)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconArrow = styled(IconArrow)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconGraphArea = styled(IconGraphArea)`
  color: ${p => p.theme.colors.white};
`;
const StyledIconGraph = styled(IconGraph)`
  color: ${p => p.theme.colors.white};
`;
