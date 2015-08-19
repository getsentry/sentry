import React from "react";
import Router from "react-router";
import api from "../api";
import DocumentTitle from "react-document-title";
import Footer from "../components/footer";
import Header from "../components/header";
import HookStore from "../stores/hookStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import OrganizationState from "../mixins/organizationState";
import PropTypes from "../proptypes";
import RouteMixin from "../mixins/routeMixin";
import TeamStore from "../stores/teamStore";

var OrganizationDetails = React.createClass({
  mixins: [
    RouteMixin
  ],

  childContextTypes: {
    organization: PropTypes.Organization
  },

  contextTypes: {
    router: React.PropTypes.func
  },

  getChildContext() {
    return {
      organization: this.state.organization
    };
  },

  getInitialState() {
    return {
      loading: true,
      error: false,
      organization: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillUnmount() {
    TeamStore.reset();
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.orgId != params.orgId) {
      this.fetchData();
    }
  },

  fetchData() {
    this.setState({
      loading: true,
      error: false
    });

    api.request(this.getOrganizationDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          organization: data,
          loading: false
        });

        TeamStore.loadInitialData(data.teams);
      },
      error: () => {
        this.setState({
          loading: false,
          error: true
        });
      }
    });
  },

  getOrganizationDetailsEndpoint() {
    var router = this.context.router;
    var params = router.getCurrentParams();
    return '/organizations/' + params.orgId + '/';
  },

  getTitle() {
    if (this.state.organization)
      return this.state.organization.name;
    return 'Sentry';
  },

  render() {
    if (this.state.loading) {
        return (
          <LoadingIndicator triangle={true}>
            Loading data for your organization.
          </LoadingIndicator>
        );
    } else if (this.state.error)
      return <LoadingError onRetry={this.fetchData} />;

    // Allow injection via getsentry et all
    var org = this.state.organization;
    var children = [];
    HookStore.get('organization:header').forEach((cb) => {
      children.push(cb(org));
    });

    var params = this.context.router.getCurrentParams();

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          {children}
          <Header orgId={params.orgId}/>
          <Router.RouteHandler />
          <Footer />
        </div>
      </DocumentTitle>
    );
  }
});

export default OrganizationDetails;

