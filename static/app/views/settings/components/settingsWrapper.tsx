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
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  line-height: 1;

  .messages-container {
    margin: 0;
  }
`;
