import DocumentTitle from 'react-document-title';
import PropTypes from 'prop-types';
import React from 'react';
import Reflux from 'reflux';
import * as Sentry from '@sentry/browser';
import createReactClass from 'create-react-class';
import styled from 'react-emotion';

import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';
import {fetchOrganizationDetails} from 'app/actionCreators/organization';
import {metric, logExperiment} from 'app/utils/analytics';
import {openSudo} from 'app/actionCreators/modal';
import {t} from 'app/locale';
import Alert from 'app/components/alert';
import ConfigStore from 'app/stores/configStore';
import GlobalSelectionStore from 'app/stores/globalSelectionStore';
import HookStore from 'app/stores/hookStore';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import OrganizationStore from 'app/stores/organizationStore';
import ProjectActions from 'app/actions/projectActions';
import TeamActions from 'app/actions/teamActions';
import SentryTypes from 'app/sentryTypes';
import Sidebar from 'app/components/sidebar';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import profiler from 'app/utils/profiler';
import space from 'app/styles/space';
import withApi from 'app/utils/withApi';
import withOrganizations from 'app/utils/withOrganizations';

const OrganizationContext = createReactClass({
  displayName: 'OrganizationContext',

  propTypes: {
    api: PropTypes.object,
    routes: PropTypes.arrayOf(PropTypes.object),
    includeSidebar: PropTypes.bool,
    useLastOrganization: PropTypes.bool,
    organizationsLoading: PropTypes.bool,
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
    finishProfile: PropTypes.func,
    detailed: PropTypes.bool,
  },

  childContextTypes: {
    organization: SentryTypes.Organization,
  },

  mixins: [
    Reflux.listenTo(ProjectActions.createSuccess, 'onProjectCreation'),
    Reflux.listenTo(OrganizationStore, 'loadOrganization'),
  ],

  getDefaultProps() {
    return {
      detailed: true,
    };
  },

  getInitialState() {
    if (this.isOrgStorePopulatedCorrectly()) {
      // retrieve initial state from store
      return OrganizationStore.get();
    }
    return {
      loading: true,
      error: null,
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

    if (this.state.organization && this.props.finishProfile) {
      this.props.finishProfile();
    }
  },

  remountComponent() {
    this.setState(this.getInitialState(), this.fetchData);
  },

  onProjectCreation() {
    // If a new project was created, we need to re-fetch the
    // org details endpoint, which will propagate re-rendering
    // for the entire component tree
    fetchOrganizationDetails(this.props.api, this.getOrganizationSlug(), true);
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

  isOrgStorePopulatedCorrectly() {
    const {detailed} = this.props;
    const {organization, dirty} = OrganizationStore.get();

    return (
      !dirty &&
      organization &&
      organization.slug === this.getOrganizationSlug() &&
      (!detailed || (detailed && organization.projects && organization.teams))
    );
  },

  async fetchData() {
    if (!this.getOrganizationSlug()) {
      this.setState({loading: this.props.organizationsLoading});
      return;
    }
    // fetch from the store, then fetch from the API if necessary
    if (this.isOrgStorePopulatedCorrectly()) {
      return;
    }
    metric.mark('organization-details-fetch-start');
    fetchOrganizationDetails(
      this.props.api,
      this.getOrganizationSlug(),
      this.props.detailed
    );
    // create a request for all teams if in lightweight org
    if (!this.props.detailed) {
      const teams = await this.props.api.requestPromise(
        this.getOrganizationTeamsEndpoint()
      );
      TeamActions.loadTeams(teams);
    }
  },

  loadOrganization(orgData) {
    const {organization, error} = orgData;
    const hooks = [];

    if (organization && !error) {
      HookStore.get('organization:header').forEach(cb => {
        hooks.push(cb(organization));
      });

      // Log exposure to the improved invite experiment
      logExperiment({
        organization,
        key: 'ImprovedInvitesExperiment',
        unitName: 'org_id',
        unitId: parseInt(organization.id, 10),
        param: 'variant',
      });

      // Configure scope to have organization tag
      Sentry.configureScope(scope => {
        scope.setTag('organization', organization.id);
      });
      // Make an exception for issue details in the case where it is accessed directly (e.g. from email)
      // We do not want to load the user's last used env/project in this case, otherwise will
      // lead to very confusing behavior.
      if (
        this.props.detailed &&
        !this.props.routes.find(
          ({path}) => path && path.includes('/organizations/:orgId/issues/:groupId/')
        )
      ) {
        GlobalSelectionStore.loadInitialData(organization, this.props.location.query);
      }
    } else if (error) {
      // If user is superuser, open sudo window
      const user = ConfigStore.get('user');
      if (!user || !user.isSuperuser || error.status !== 403) {
        // This `catch` can swallow up errors in development (and tests)
        // So let's log them. This may create some noise, especially the test case where
        // we specifically test this branch
        console.error(error); // eslint-disable-line no-console
      } else {
        openSudo({
          retryRequest: () => Promise.resolve(this.fetchData()),
        });
      }
    }

    this.setState({...orgData, hooks}, () => {
      // Take a measurement for when organization details are done loading and the new state is applied
      if (organization) {
        metric.measure({
          name: 'app.component.perf',
          start: 'organization-details-fetch-start',
          data: {
            name: 'org-details',
            route: getRouteStringFromRoutes(this.props.routes),
            organization_id: parseInt(organization.id, 10),
          },
        });
      }
    });
  },

  getOrganizationDetailsEndpoint() {
    return `/organizations/${this.getOrganizationSlug()}/`;
  },

  getOrganizationTeamsEndpoint() {
    return `/organizations/${this.getOrganizationSlug()}/teams/`;
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
      case ORGANIZATION_FETCH_ERROR_TYPES.ORG_NOT_FOUND:
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

export default withApi(withOrganizations(profiler()(OrganizationContext)));
export {OrganizationContext};

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;
