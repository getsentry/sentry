import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';

import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import {useParams} from 'sentry/utils/useParams';
import {useRoutes} from 'sentry/utils/useRoutes';

import SettingsBreadcrumb from './settingsBreadcrumb';
import SettingsHeader from './settingsHeader';
import SettingsSearch from './settingsSearch';

interface Props {
  children: React.ReactNode;
}

export default function SettingsLayout({children}: Props) {
  const params = useParams();
  const routes = useRoutes();

  return (
    <SettingsColumn>
      <SettingsHeader>
        <Flex align="center" justify="between">
          <StyledSettingsBreadcrumb params={params} routes={routes} />
          <SettingsSearch />
        </Flex>
      </SettingsHeader>

      <Flex flex="1" maxWidth="1440px">
        <Content>{children}</Content>
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

/**
 * Note: `overflow: hidden` will cause some buttons in `SettingsPageHeader` to be cut off because it has negative margin.
 * Will also cut off tooltips.
 */
const Content = styled('div')`
  flex: 1;
  padding: ${space(4)};
  min-width: 0; /* keep children from stretching container */

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    padding: ${space(2)};
  }

  /**
   * Layout.Page is not normally used in settings but <PermissionDenied /> uses
   * it under the hood. This prevents double padding.
   */
  ${Layout.Page} {
    padding: 0;
  }
`;
