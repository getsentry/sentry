import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';
import {useHasPageFrameFeature} from 'sentry/views/navigation/useHasPageFrameFeature';

import {SettingsBreadcrumb} from './settingsBreadcrumb';
import {SettingsHeader} from './settingsHeader';
import {SettingsSearch} from './settingsSearch';

interface Props {
  children: React.ReactNode;
}

export function SettingsLayout({children}: Props) {
  const params = useParams();
  const routes = useRoutes();

  const hasPageFrame = useHasPageFrameFeature();

  return (
    <SettingsColumn>
      <SettingsHeader>
        <Flex align="center" justify="between">
          <StyledSettingsBreadcrumb params={params} routes={routes} />
          <SettingsSearch />
        </Flex>
      </SettingsHeader>

      <Flex flex="1" maxWidth="1440px">
        <Container
          flex="1"
          padding={hasPageFrame ? {sm: 'xl', md: 'md xl'} : {xs: 'xl', md: '3xl'}}
          minWidth="0"
        >
          {children}
        </Container>
      </Flex>
    </SettingsColumn>
  );
}

const SettingsColumn = styled('div')`
  display: flex;
  flex-direction: column;
  flex: 1; /* so this stretches vertically so that footer is fixed at bottom */
  min-width: 0; /* fixes problem when child content stretches beyond layout width */
  footer {
    margin-top: 0;
  }
`;

const StyledSettingsBreadcrumb = styled(SettingsBreadcrumb)`
  flex: 1;
`;
