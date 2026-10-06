import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {SettingsBreadcrumb} from 'sentry/views/settings/components/settingsBreadcrumb';
export default function SubscriptionSettingsLayout() {
  const params = useParams();

  return (
    <SettingsColumn>
      <SettingsBreadcrumb params={params} />

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
