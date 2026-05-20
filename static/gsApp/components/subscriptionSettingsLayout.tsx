import {Outlet} from 'react-router-dom';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {TopBar} from 'sentry/views/navigation/topBar';
import {SettingsBreadcrumb} from 'sentry/views/settings/components/settingsBreadcrumb';
import {SettingsSearch} from 'sentry/views/settings/components/settingsSearch';

export default function SubscriptionSettingsLayout() {
  const params = useParams();

  return (
    <SettingsColumn>
      <TopBar.Slot name="title">
        <StyledSettingsBreadcrumb params={params} />
      </TopBar.Slot>
      <TopBar.Slot name="search">
        <SettingsSearch />
      </TopBar.Slot>

      <Flex flex="1" minWidth="0">
        <Outlet />
      </Flex>
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

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;
