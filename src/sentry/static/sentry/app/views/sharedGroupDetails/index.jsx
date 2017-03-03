import React from 'react';
import jQuery from 'jquery';
import DocumentTitle from 'react-document-title';

import ApiMixin from '../../mixins/apiMixin';
import EventEntries from '../../components/events/eventEntries';
import Footer from '../../components/footer';
import LoadingError from '../../components/loadingError';
import LoadingIndicator from '../../components/loadingIndicator';
import PropTypes from '../../proptypes';

import SharedGroupHeader from './sharedGroupHeader';

const SharedGroupDetails = React.createClass({
  childContextTypes: {
    group: PropTypes.Group,
  },

  mixins: [
    ApiMixin
  ],

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false
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
    if (this.state.group)
      return this.state.group.title;
    return 'Sentry';
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    this.api.request(this.getGroupDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          loading: false,
          group: data
        });
      }, error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getGroupDetailsEndpoint() {
    let id = this.props.params.shareId;

    return '/shared/issues/' + id + '/';
  },

  render() {
    let group = this.state.group;

    if (this.state.loading || !group)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    let evt = this.state.group.latestEvent;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <div className="pattern-bg" />
          <div className="container">
            <div className="box box-modal">
              <div className="box-header">
                <a href="/">
                  <span className="icon-sentry-logo-full" />
                </a>
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
                        isShare={true} />
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
  }
});

export default SharedGroupDetails;
