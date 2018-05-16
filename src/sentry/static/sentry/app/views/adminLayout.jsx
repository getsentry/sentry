/*eslint getsentry/jsx-needs-il8n:0*/
import DocumentTitle from 'react-document-title';
import React from 'react';

import Footer from 'app/components/footer';
import Sidebar from 'app/components/sidebar';
import HookStore from 'app/stores/hookStore';
import ListLink from 'app/components/listLink';

export default class extends React.Component {
  constructor(props) {
    super(props);
    // Allow injection via getsentry et all
    let hooksManage = [];
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
          <Sidebar />
          <div className="container">
            <div className="content">
              <div className="row">
                <div className="col-md-2">
                  <h6 className="nav-header">System</h6>
                  <ul className="nav nav-stacked">
                    <ListLink index={true} to="/manage/">
                      Overview
                    </ListLink>
                    <ListLink index={true} to="/manage/buffer/">
                      Buffer
                    </ListLink>
                    <ListLink index={true} to="/manage/queue/">
                      Queue
                    </ListLink>
                    <ListLink index={true} to="/manage/quotas/">
                      Quotas
                    </ListLink>
                    <li>
                      <a href="/manage/status/environment/">Environment</a>
                    </li>
                    <li>
                      <a href="/manage/status/packages/">Packages</a>
                    </li>
                    <li>
                      <a href="/manage/status/mail/">Mail</a>
                    </li>
                    <ListLink to="/manage/settings/">Settings</ListLink>
                    <li>
                      <a href="/manage/status/warnings/">Warnings</a>
                    </li>
                  </ul>

                  <h6 className="nav-header">Manage</h6>
                  <ul className="nav nav-stacked">
                    <ListLink to="/manage/relays/">Relays</ListLink>
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
