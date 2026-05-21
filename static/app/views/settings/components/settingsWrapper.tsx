import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Flex} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useLocation} from 'sentry/utils/useLocation';
import {useScrollToTop} from 'sentry/utils/useScrollToTop';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';
import {SettingsCommandPaletteActions} from 'sentry/views/settings/settingsCommandPaletteActions';

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

export function SettingsWrapper() {
  const location = useLocation();
  useScrollToTop({location, disable: scrollDisable});

  return (
    <AnalyticsArea name="settings">
      <StyledFlex flex="1" background="primary">
        <BreadcrumbProvider>
          <SettingsCommandPaletteActions />
          <Outlet />
        </BreadcrumbProvider>
      </StyledFlex>
    </AnalyticsArea>
  );
}

const StyledFlex = styled(Flex)`
  .messages-container {
    margin: 0;
  }
`;
