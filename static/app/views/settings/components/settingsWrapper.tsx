import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';
import type {Location} from 'history';

import {useLocation} from 'sentry/utils/useLocation';
import useScrollToTop from 'sentry/utils/useScrollToTop';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

export default function SettingsWrapper() {
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

const StyledSettingsWrapper = styled('div')`
  display: flex;
  flex: 1;
  font-size: ${p => p.theme.fontSize.md};
  line-height: ${p => p.theme.font.lineHeight.default};
  color: ${p => p.theme.tokens.content.primary};

  .messages-container {
    margin: 0;
  }
`;
