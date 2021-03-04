import React from 'react';
import DocumentTitle from 'react-document-title';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';

const AdminLayout: React.FC = ({children}) => (
  <DocumentTitle title="Sentry Admin">
    <Page>
      <NavWrapper>
        <SettingsNavigation
          stickyTop="0"
          navigationObjects={[
            {
              name: 'System Status',
              items: [
                {path: '/manage/', index: true, title: 'Overview'},
                {path: '/manage/buffer/', title: 'Buffer'},
                {path: '/manage/queue/', title: 'Queue'},
                {path: '/manage/quotas/', title: 'Quotas'},
                {path: '/manage/status/environment/', title: 'Environment'},
                {path: '/manage/status/packages/', title: 'Packages'},
                {path: '/manage/status/mail/', title: 'Mail'},
                {path: '/manage/status/warnings/', title: 'Warnings'},
                {path: '/manage/settings/', title: 'Settings'},
              ],
            },
            {
              name: 'Manage',
              items: [
                {path: '/manage/organizations/', title: 'Organizations'},
                {path: '/manage/projects/', title: 'Projects'},
                {path: '/manage/users/', title: 'Users'},
              ],
            },
          ]}
        />
      </NavWrapper>
      <Content>{children}</Content>
    </Page>
  </DocumentTitle>
);

const NavWrapper = styled('div')`
  flex-shrink: 0;
  flex-grow: 0;
  width: ${p => p.theme.settings.sidebarWidth};
  background: ${p => p.theme.white};
  border-right: 1px solid ${p => p.theme.border};
`;

const Page = styled('div')`
  display: flex;
  flex-grow: 1;
  margin-bottom: -20px;
`;

const Content = styled('div')`
  flex-grow: 1;
  padding: ${space(4)};
`;

export default AdminLayout;
