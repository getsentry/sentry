import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {Flex, Stack} from '@sentry/scraps/layout';

import {AnalyticsArea} from 'sentry/components/analyticsArea';
import {useLocation} from 'sentry/utils/useLocation';
import {useScrollToTop} from 'sentry/utils/useScrollToTop';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

export function SettingsWrapper() {
  const location = useLocation();
  useScrollToTop({location, disable: scrollDisable});

  const hasPageFrame = useHasPageFrameFeature();

  return (
    <AnalyticsArea name="settings">
      <Stack flex={1}>
        <StyledFlex flex="1" background={hasPageFrame ? 'primary' : undefined}>
        <BreadcrumbProvider>
          <Outlet />
        </BreadcrumbProvider>
        </StyledFlex>
      </Stack>
    </AnalyticsArea>
  );
}

const StyledFlex = styled(Flex)`
  .messages-container {
    margin: 0;
  }
`;
