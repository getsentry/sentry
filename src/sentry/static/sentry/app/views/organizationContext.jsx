import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';
import * as Sentry from '@sentry/browser';

import {fetchOrganizationEnvironments} from 'app/actionCreators/environments';
import {openSudo} from 'app/actionCreators/modal';
import {setActiveOrganization} from 'app/actionCreators/organizations';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import withApi from 'app/utils/withApi';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import HookStore from 'app/stores/hookStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationEnvironmentsStore from 'app/stores/organizationEnvironmentsStore';
import ProjectActions from 'app/actions/projectActions';
import ProjectsStore from 'app/stores/projectsStore';
import SentryTypes from 'app/sentryTypes';
import Sidebar from 'app/components/sidebar';
import TeamStore from 'app/stores/teamStore';
import space from 'app/styles/space';
import withOrganizations from 'app/utils/withOrganizations';
import {metric} from 'app/utils/analytics';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';

const ERROR_TYPES = {
  ORG_NOT_FOUND: 'ORG_NOT_FOUND',
};

const OrganizationContext = createReactClass({
  displayName: 'OrganizationContext',

  propTypes: {
    api: PropTypes.object,
    routes: PropTypes.arrayOf(PropTypes.object),
    includeSidebar: PropTypes.bool,
    useLastOrganization: PropTypes.bool,
    organizationsLoading: PropTypes.bool,
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
  },

  childContextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [Reflux.listenTo(ProjectActions.createSuccess, 'onProjectCreation')],

  getInitialState() {
    return {
      loading: true,
      error: false,
      errorType: null,
      organization: null,
    };
  },

  getChildContext() {
    return {
      organization: this.state.organization,
    };
  },

  componentDidMount() {
    this.fetchData();
  },

  componentDidUpdate(prevProps) {
    const hasOrgIdAndChanged =
      prevProps.params.orgId &&
      this.props.params.orgId &&
      prevProps.params.orgId !== this.props.params.orgId;

    // protect against the case where we finish fetching org details
    // and then `OrganizationsStore` finishes loading:
    // only fetch in the case where we don't have an orgId
    const organizationLoadingChanged =
      prevProps.organizationsLoading !== this.props.organizationsLoading &&
      this.props.organizationsLoading === false;

    if (
      hasOrgIdAndChanged ||
      (!this.props.params.orgId && organizationLoadingChanged) ||
      (this.props.location.state === 'refresh' && prevProps.location.state !== 'refresh')
    ) {
      this.remountComponent();
    }
  },

  componentWillUnmount() {
    TeamStore.reset();
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  onProjectCreation() {
    // If a new project was created, we need to re-fetch the
    // org details endpoint, which will propagate re-rendering
    // for the entire component tree
    this.fetchData();
  },

  getOrganizationSlug() {
    return (
      this.props.params.orgId ||
      (this.props.useLastOrganization &&
        (ConfigStore.get('lastOrganization') ||
          (this.props.organizations &&
            this.props.organizations.length &&
            this.props.organizations[0].slug)))
    );
  },

  fetchData() {
    if (!this.getOrganizationSlug()) {
      this.setState({loading: this.props.organizationsLoading});
      return;
    }

    metric.mark('organization-details-fetch-start');
    const promises = [
      this.props.api.requestPromise(this.getOrganizationDetailsEndpoint()),
      fetchOrganizationEnvironments(this.props.api, this.getOrganizationSlug()),
    ];

    Promise.all(promises)
      .then(([data, environments]) => {
        // Allow injection via getsentry et all
        const hooks = [];
        HookStore.get('organization:header').forEach(cb => {
          hooks.push(cb(data));
        });

        setActiveOrganization(data);

        // Configure scope to have organization tag
        Sentry.configureScope(scope => {
          scope.setTag('organization', data.id);
        });

        TeamStore.loadInitialData(data.teams);
        ProjectsStore.loadInitialData(data.projects);

        // Make an exception for issue details in the case where it is accessed directly (e.g. from email)
        // We do not want to load the user's last used env/project in this case, otherwise will
        // lead to very confusing behavior.
        if (
          !this.props.routes.find(
            ({path}) => path && path.includes('/organizations/:orgId/issues/:groupId/')
          )
        ) {
          GlobalSelectionStore.loadInitialData(data, this.props.location.query);
        }
        OrganizationEnvironmentsStore.loadInitialData(environments);
        this.setState(
          {
            organization: data,
            loading: false,
            error: false,
            errorType: null,
            hooks,
          },
          () => {
            // Take a measurement for when organization details are done loading and the new state is applied
            metric.measure({
              name: 'app.component.perf',
              start: 'organization-details-fetch-start',
              data: {
                name: 'org-details',
                route: getRouteStringFromRoutes(this.props.routes),
                organization_id: parseInt(data.id, 10),
              },
            });
          }
        );
      })
      .catch(err => {
        let errorType = null;

        switch (err.statusText) {
          case 'NOT FOUND':
            errorType = ERROR_TYPES.ORG_NOT_FOUND;
            break;
          default:
        }
        this.setState({
          loading: false,
          error: true,
          errorType,
        });

        // If user is superuser, open sudo window
        const user = ConfigStore.get('user');
        if (!user || !user.isSuperuser || err.status !== 403) {
          // This `catch` can swallow up errors in development (and tests)
          // So let's log them. This may create some noise, especially the test case where
          // we specifically test this branch
          console.error(err); // eslint-disable-line no-console
          return;
        }
        openSudo({
          retryRequest: () => Promise.resolve(this.fetchData()),
        });
      });
  },

  getOrganizationDetailsEndpoint() {
    return `/organizations/${this.getOrganizationSlug()}/`;
  },

  getTitle() {
    if (this.state.organization) {
      return this.state.organization.name;
    }
    return 'Sentry';
  },

  renderSidebar() {
    if (!this.props.includeSidebar) {
      return null;
    }

    return <Sidebar {...this.props} organization={this.state.organization} />;
  },

  renderError() {
    let errorComponent;

    switch (this.state.errorType) {
      case ERROR_TYPES.ORG_NOT_FOUND:
        errorComponent = (
          <Alert type="error">
            {t('The organization you were looking for was not found.')}
          </Alert>
        );
        break;
      default:
        errorComponent = <LoadingError onRetry={this.remountComponent} />;
    }

    return <ErrorWrapper>{errorComponent}</ErrorWrapper>;
  },

  render() {
    if (this.state.loading) {
      return (
        <LoadingIndicator triangle>
          {t('Loading data for your organization.')}
        </LoadingIndicator>
      );
    }

    if (this.state.error) {
      return (
        <React.Fragment>
          {this.renderSidebar()}
          {this.renderError()}
        </React.Fragment>
      );
    }

    return (
      <DocumentTitle title={this.getTitle()}>
        <div className="app">
          {this.state.hooks}
          {this.renderSidebar()}
          {this.props.children}
        </div>
      </DocumentTitle>
    );
  },
});

export default withApi(withOrganizations(OrganizationContext));
export {OrganizationContext};

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;
