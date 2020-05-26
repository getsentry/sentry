import DocumentTitle from 'react-document-title';
import React from 'react';
import styled from '@emotion/styled';

import space from 'app/styles/space';
import ListLink from 'app/components/links/listLink';

const AdminLayout: React.FC = ({children}) => (
  <DocumentTitle title="Sentry Admin">
    <Page>
      <div>
        <h6 className="nav-header">System</h6>
        <ul className="nav nav-stacked">
          <ListLink index to="/manage/">
            Overview
          </ListLink>
          <ListLink index to="/manage/buffer/">
            Buffer
          </ListLink>
          <ListLink index to="/manage/queue/">
            Queue
          </ListLink>
          <ListLink index to="/manage/quotas/">
            Quotas
          </ListLink>
          <ListLink index to="/manage/status/environment/">
            Environment
          </ListLink>
          <ListLink index to="/manage/status/packages/">
            Packages
          </ListLink>
          <ListLink index to="/manage/status/mail/">
            Mail
          </ListLink>
          <ListLink index to="/manage/status/warnings/">
            Warnings
          </ListLink>
          <ListLink index to="/manage/settings/">
            Settings
          </ListLink>
        </ul>
        <h6 className="nav-header">Manage</h6>
        <ul className="nav nav-stacked">
          <ListLink to="/manage/organizations/">Organizations</ListLink>
          <ListLink to="/manage/projects/">Projects</ListLink>
          <ListLink to="/manage/users/">Users</ListLink>
        </ul>
      </div>
      <div>{children}</div>
    </Page>
  </DocumentTitle>
);

const Page = styled('div')`
  display: grid;
  grid-template-columns: 200px 1fr;
  margin: ${space(4)};
  flex-grow: 1;
`;

export default AdminLayout;
