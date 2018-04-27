import DocumentTitle from 'react-document-title';
import React from 'react';
import createReactClass from 'create-react-class';
import jQuery from 'jquery';

import {t} from 'app/locale';
import ApiMixin from 'app/mixins/apiMixin';
import EventEntries from 'app/components/events/eventEntries';
import Footer from 'app/components/footer';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import NotFound from 'app/components/errors/notFound';
import SentryTypes from 'app/proptypes';
import SharedGroupHeader from 'app/views/sharedGroupDetails/sharedGroupHeader';

const SharedGroupDetails = createReactClass({
  displayName: 'SharedGroupDetails',

  childContextTypes: {
    group: SentryTypes.Group,
  },

  mixins: [ApiMixin],

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false,
    };
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass('shared-group');
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass('shared-group');
  },

  getTitle() {
    if (this.state.group) return this.state.group.title;
    return 'Sentry';
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false,
    });

    this.api.request(this.getGroupDetailsEndpoint(), {
      success: data => {
        this.setState({
          loading: false,
          group: data,
        });
      },
      error: () => {
        this.setState({
          loading: false,
          error: true,
        });
      },
    });
  },

  getGroupDetailsEndpoint() {
    let id = this.props.params.shareId;

    return '/shared/issues/' + id + '/';
  },

  render() {
    let group = this.state.group;

    if (this.state.loading) {
      return <LoadingIndicator />;
    } else if (!group) {
      return <NotFound />;
    } else if (this.state.error) {
      return <LoadingError onRetry={this.fetchData} />;
    }

    let evt = this.state.group.latestEvent;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <div className="pattern-bg" />
          <div className="container">
            <div className="box box-modal">
              <div className="box-header">
                <a className="logo" href="/">
                  <span className="icon-sentry-logo-full" />
                </a>
                {this.state.group.permalink && (
                  <a className="details" href={this.state.group.permalink}>
                    {t('Details')}
                  </a>
                )}
              </div>
              <div className="box-content">
                <div className="content">
                  <SharedGroupHeader group={group} />
                  <div className="group-overview event-details-container">
                    <div className="primary">
                      <EventEntries
                        group={group}
                        event={evt}
                        orgId={group.project.organization.slug}
                        project={group.project}
                        isShare={true}
                      />
                    </div>
                  </div>
                  <Footer />
                </div>
              </div>
            </div>
          </div>
        </div>
      </DocumentTitle>
    );
  },
});

export default SharedGroupDetails;
