import styled from '@emotion/styled';
import type {Location} from 'history';

import useScrollToTop from 'sentry/utils/useScrollToTop';
import {BreadcrumbProvider} from 'sentry/views/settings/components/settingsBreadcrumb/context';

type Props = {
  children: React.ReactNode;
  location: Location;
};

function scrollDisable(newLocation: Location, prevLocation: Location) {
  return newLocation.pathname === prevLocation.pathname;
}

function SettingsWrapper({location, children}: Props) {
  useScrollToTop({location, disable: scrollDisable});

  return (
    <StyledSettingsWrapper>
      <BreadcrumbProvider>{children}</BreadcrumbProvider>
    </StyledSettingsWrapper>
  );
}

export default SettingsWrapper;

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
