import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import ScrollToTop from 'app/views/settings/components/scrollToTop';
import space from 'app/styles/space';

type Props = {
  location: Location;
  children: React.ReactNode;
};

const SettingsWrapper = ({children, ...props}: Props) => {
  const handleShouldDisableScrollToTop = (location: Location, prevLocation: Location) => {
    // we do not want to scroll to top when user just perform a search
    return (
      location.pathname === prevLocation.pathname &&
      location.query?.query !== prevLocation.query?.query
    );
  };

  return (
    <StyledSettingsWrapper>
      <ScrollToTop location={props.location} disable={handleShouldDisableScrollToTop}>
        {children}
      </ScrollToTop>
    </StyledSettingsWrapper>
  );
};

export default SettingsWrapper;

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.gray800};
  margin-bottom: -${space(3)}; /* to account for footer margin top */
  line-height: 1;

  .messages-container {
    margin: 0;
  }
`;
