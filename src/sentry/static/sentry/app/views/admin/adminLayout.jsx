import DocumentTitle from 'react-document-title';
import React from 'react';

import Hook from 'app/components/hook';
import ListLink from 'app/components/links/listLink';
import Sidebar from 'app/components/sidebar';

export default class AdminLayout extends React.Component {
  getTitle = () => {
    return 'Sentry Admin';
  };

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app" css={{paddingTop: 20}}>
          <Sidebar />
          <div className="container">
            <div className="content">
              <div className="row">
                <div className="col-md-2">
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
                    <Hook name="admin:sidebar:manage" />
                  </ul>
                </div>
                <div className="col-md-10">{this.props.children}</div>
              </div>
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  }
}
