import React from "react";
import Router from "react-router";
import api from "../api";
import DocumentTitle from "react-document-title";
import Footer from "../components/footer";
import Header from "../components/header";
import HookStore from "../stores/hookStore";
import LoadingError from "../components/loadingError";
import LoadingIndicator from "../components/loadingIndicator";
import PropTypes from "../proptypes";
import RouteMixin from "../mixins/routeMixin";
import TeamStore from "../stores/teamStore";

const ERROR_TYPES = {
  ORG_NOT_FOUND: "ORG_NOT_FOUND"
};

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
      errorType: null,
      organization: null
    };
  },

  componentWillMount() {
    this.fetchData();
  },

  componentWillUnmount() {
    TeamStore.reset();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  routeDidChange(nextPath, nextParams) {
    var router = this.context.router;
    var params = router.getCurrentParams();
    if (nextParams.orgId != params.orgId) {
      this.remountComponent();
    }
  },

  fetchData() {
    api.request(this.getOrganizationDetailsEndpoint(), {
      success: (data) => {
        this.setState({
          organization: data,
          loading: false,
          error: false,
          errorType: null
        });

        TeamStore.loadInitialData(data.teams);
      }, error: (_, textStatus, errorThrown) => {
        let errorType = null;
        switch (errorThrown) {
          case "NOT FOUND":
            errorType = ERROR_TYPES.ORG_NOT_FOUND;
            break;
          default:
        }
        this.setState({
          loading: false,
          error: true,
          errorType: errorType,
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
    } else if (this.state.error) {
      switch (this.state.errorType) {
        case ERROR_TYPES.ORG_NOT_FOUND:
          return (
            <div className="container">
              <div className="alert alert-block">The organization you were looking for was not found.</div>
            </div>
          );
        default:
          return <LoadingError onRetry={this.remountComponent} />;
      }
    }

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
