import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {TopBar} from 'sentry/views/navigation/topBar';

import {SettingsBreadcrumb} from './settingsBreadcrumb';
import {SettingsSearch} from './settingsSearch';

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
      <TopBar.Slot name="search">
        <SettingsSearch />
      </TopBar.Slot>

      <Flex flex="1">
        <Container flex="1" padding={{sm: 'xl', md: 'xl'}} minWidth="0">
          {children}
        </Container>
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
