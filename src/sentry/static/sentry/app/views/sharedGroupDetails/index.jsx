import React from "react";
import jQuery from "jquery";
import DocumentTitle from "react-document-title";

import api from "../../api";
import EventEntries from "../../components/events/eventEntries";
import Footer from "../../components/footer";
import Header from "../../components/header";
import LoadingError from "../../components/loadingError";
import LoadingIndicator from "../../components/loadingIndicator";
import PropTypes from "../../proptypes";

import SharedGroupHeader from "./sharedGroupHeader";

var SharedGroupDetails = React.createClass({
  contextTypes: {
    router: React.PropTypes.func
  },

  childContextTypes: {
    group: PropTypes.Group,
  },

  getChildContext() {
    return {
      group: this.state.group,
    };
  },

  getInitialState() {
    return {
      group: null,
      loading: true,
      error: false
    };
  },

  getTitle() {
    if (this.state.group)
      return this.state.group.title;
    return 'Sentry';
  },

  componentWillMount() {
    this.fetchData();
    jQuery(document.body).addClass("shared-group");
  },

  componentWillUnmount() {
    jQuery(document.body).removeClass("shared-group");
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getGroupDetailsEndpoint(), {
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
    var id = this.context.router.getCurrentParams().shareId;

    return '/shared/groups/' + id + '/';
  },

  render() {
    var group = this.state.group;

    if (this.state.loading || !group)
      return <LoadingIndicator />;
    else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    var evt = this.state.group.latestEvent;

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          <Header />
          <div className="container">
            <div className="content">
              <SharedGroupHeader group={group} />
              <div className="group-overview">
                <EventEntries group={group} event={evt} isShare={true} />
              </div>
            </div>
          </div>
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

export default SharedGroupDetails;
