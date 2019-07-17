import DocumentTitle from 'react-document-title';
import React from 'react';

import Footer from 'app/components/footer';
import HookStore from 'app/stores/hookStore';
import ListLink from 'app/components/links/listLink';
import Sidebar from 'app/components/sidebar';
import withLatestContext from 'app/utils/withLatestContext';

const SidebarWithLatest = withLatestContext(Sidebar);

export default class AdminLayout extends React.Component {
  constructor(props) {
    super(props);
    // Allow injection via getsentry et all
    const hooksManage = [];
    HookStore.get('admin:sidebar:manage').forEach(cb => {
      hooksManage.push(cb());
    });

    this.state = {
      hooksManage,
    };
  }

  getTitle = () => {
    return 'Sentry Admin';
  };

  render() {
    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app" css={{paddingTop: 20}}>
          <SidebarWithLatest />
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
                    {this.state.hooksManage}
                  </ul>
                </div>
                <div className="col-md-10">{this.props.children}</div>
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
}
