import styled from '@emotion/styled';
import {Location} from 'history';

import space from 'sentry/styles/space';
import ScrollToTop from 'sentry/views/settings/components/scrollToTop';

type Props = {
  location: Location;
  children: React.ReactChildren;
};

function SettingsWrapper({location, children}: Props) {
  return (
    <StyledSettingsWrapper>
      <ScrollToTop
        location={location}
        disable={(newLocation, prevLocation) =>
          newLocation.pathname === prevLocation.pathname &&
          newLocation.query?.query !== prevLocation.query?.query
        }
      />
      {children}
    </StyledSettingsWrapper>
  );
}

export default SettingsWrapper;

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.textColor};
  margin-bottom: -${space(3)}; /* to account for footer margin top */
  line-height: 1;

  .messages-container {
    margin: 0;
  }
`;
