import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'sentry/styles/space';
import useScrollToTop from 'sentry/utils/useScrollToTop';

type Props = {
  location: Location;
  children: React.ReactChildren;
};

function SettingsWrapper({location, children}: Props) {
  useScrollToTop({
    location,
    disable: (newLocation, prevLocation) =>
      newLocation.pathname === prevLocation.pathname &&
      newLocation.query?.query !== prevLocation.query?.query,
  });

  return <StyledSettingsWrapper>{children}</StyledSettingsWrapper>;
}

export default SettingsWrapper;

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.textColor};
  margin-bottom: -${space(3)}; /* to account for footer margin top */

  .messages-container {
    margin: 0;
  }
`;
