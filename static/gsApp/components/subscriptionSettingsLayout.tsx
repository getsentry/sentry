import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {BreadcrumbTitle} from 'sentry/views/settings/components/settingsBreadcrumb/breadcrumbTitle';
export default function SubscriptionSettingsLayout() {
  return (
    <SettingsColumn>
      <BreadcrumbTitle fallback />

      <Container flex="1" minWidth="0" background="primary">
        <Outlet />
      </Container>
    </SettingsColumn>
  );
}

const SettingsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1;
  min-width: 0;
  footer {
    margin-top: 0;
  }
`;
