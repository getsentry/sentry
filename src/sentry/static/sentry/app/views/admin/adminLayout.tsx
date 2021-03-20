import React from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import SettingsLayout from 'app/views/settings/components/settingsLayout';
import SettingsNavigation from 'app/views/settings/components/settingsNavigation';

const AdminNavigation = () => (
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
);

type Props = {
  children: React.ReactNode;
} & RouteComponentProps<{}, {}>;

class AdminLayout extends React.Component<Props> {
  render() {
    const {children, ...props} = this.props;
    return (
      <DocumentTitle title="Sentry Admin">
        <Page>
          <SettingsLayout renderNavigation={AdminNavigation} {...props}>
            {children}
          </SettingsLayout>
        </Page>
      </DocumentTitle>
    );
  }
}

const Page = styled('div')`
  display: flex;
  flex-grow: 1;
  margin-bottom: -20px;
`;

export default AdminLayout;
