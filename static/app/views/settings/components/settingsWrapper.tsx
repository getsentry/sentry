import styled from '@emotion/styled';
import {Location} from 'history';

import useScrollToTop from 'sentry/utils/useScrollToTop';

type Props = {
  children: React.ReactChildren;
  location: Location;
};

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

function SettingsWrapper({location, children}: Props) {
  useScrollToTop({location, disable: scrollDisable});

  return <StyledSettingsWrapper>{children}</StyledSettingsWrapper>;
}

export default SettingsWrapper;

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  line-height: ${p => p.theme.text.lineHeightBody};
  color: ${p => p.theme.textColor};

  .messages-container {
    margin: 0;
  }
`;
