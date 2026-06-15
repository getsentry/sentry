import styled from '@emotion/styled';

import {Stack, Flex} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {TopBar} from 'sentry/views/navigation/topBar';

import {SettingsBreadcrumb} from './settingsBreadcrumb';

interface Props {
  children: React.ReactNode;
}

export function SettingsLayout({children}: Props) {
  const params = useParams();

  return (
    <SettingsColumn>
      <TopBar.Slot name="title">
        <StyledSettingsBreadcrumb params={params} />
      </TopBar.Slot>
      <Flex flex="1">
        <Stack flex="1" padding="xl" minWidth="0">
          {children}
        </Stack>
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
