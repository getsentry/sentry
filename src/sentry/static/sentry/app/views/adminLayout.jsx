/*eslint getsentry/jsx-needs-il8n:0*/
import DocumentTitle from 'react-document-title';
import React from 'react';

import Footer from '../components/footer';
import Sidebar from '../components/sidebar';
import HookStore from '../stores/hookStore';
import ListLink from '../components/listLink';

import { t } from '../locale';

export default React.createClass({
    getInitialState() {
        // Allow injection via getsentry et all
        let hooksManage = [];
        HookStore.get('admin:sidebar:manage').forEach(cb => {
            hooksManage.push(cb());
        });

        return {
            hooksManage,
        };
    },

    getTitle() {
        return 'Sentry Admin';
    },

    render() {
        return (
            <DocumentTitle title={this.getTitle()}>
                <div className="app">
                    <Sidebar />
                    <div className="container">
                        <div className="content">
                            <div className="row">
                                <div className="col-md-2">
                                    <h6 className="nav-header">System</h6>
                                    <ul className="nav nav-stacked">
                                        <ListLink index={true} to="/manage/">{t('Overview')}</ListLink>
                                        <ListLink index={true} to="/manage/buffer/">{t('Buffer')}</ListLink>
                                        <ListLink index={true} to="/manage/queue/">{t('Queue')}</ListLink>
                                        <li>
                                            <a href="/manage/status/environment/">{t('Environment')}</a>
                                        </li>
                                        <li>
                                            <a href="/manage/status/packages/">{t('Packages')}</a>
                                        </li>
                                        <li>
                                            <a href="/manage/status/mail/">{t('Mail')}</a>
                                        </li>
                                        <ListLink to="/manage/settings/">{t('Settings')}</ListLink>
                                        <li>
                                            <a href="/manage/status/warnings/">{t('Warnings')}</a>
                                        </li>
                                    </ul>

                                    <h6 className="nav-header">{t('Manage')}</h6>
                                    <ul className="nav nav-stacked">
                                        <ListLink to="/manage/organizations/">{t('Organizations')}</ListLink>
                                        <ListLink to="/manage/projects/">{t('Projects')}</ListLink>
                                        <ListLink to="/manage/users/">{t('Users')}</ListLink>
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
    },
});
