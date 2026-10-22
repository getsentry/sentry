import {Outlet} from 'react-router';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Flex} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useLocation} from 'sentry/utils/useLocation';
import {useScrollToTop} from 'sentry/utils/useScrollToTop';
import {SettingsCommandPaletteActions} from 'sentry/views/settings/settingsCommandPaletteActions';

import {SettingsBreadcrumbsProvider} from './settingsBreadcrumb/settingsBreadcrumbsProvider';

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

export function SettingsWrapper() {
  const location = useLocation();
  useScrollToTop({location, disable: scrollDisable});

  return (
    <AnalyticsArea name="settings">
      <SettingsBreadcrumbsProvider>
        <StyledFlex flex="1" background="primary">
          <SettingsCommandPaletteActions />
          <Outlet />
        </StyledFlex>
      </SettingsBreadcrumbsProvider>
    </AnalyticsArea>
  );
}

const StyledFlex = styled(Flex)`
  .messages-container {
    margin: 0;
  }
`;
