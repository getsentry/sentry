import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import useScrollToTop from 'sentry/utils/useScrollToTop';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

function SettingsWrapper() {
  const location = useLocation();
  useScrollToTop({location, disable: scrollDisable});

  return (
    <StyledSettingsWrapper>
      <BreadcrumbProvider>
        <Outlet />
      </BreadcrumbProvider>
    </StyledSettingsWrapper>
  );
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
