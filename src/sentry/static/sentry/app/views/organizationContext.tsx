import React from 'react';
import DocumentTitle from 'react-document-title';
import {RouteComponentProps} from 'react-router';
import {PlainRoute} from 'react-router/lib/Route';
import styled from '@emotion/styled';
import * as Sentry from '@sentry/react';
import PropTypes from 'prop-types';

import {openSudo} from 'app/actionCreators/modal';
import {fetchOrganizationDetails} from 'app/actionCreators/organization';
import ProjectActions from 'app/actions/projectActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import LoadingError from 'app/components/loadingError';
import LoadingIndicator from 'app/components/loadingIndicator';
import Sidebar from 'app/components/sidebar';
import {ORGANIZATION_FETCH_ERROR_TYPES} from 'app/constants';
import {t} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import ConfigStore from 'app/stores/configStore';
import HookStore from 'app/stores/hookStore';
import OrganizationStore from 'app/stores/organizationStore';
import space from 'app/styles/space';
import {Organization} from 'app/types';
import {metric} from 'app/utils/analytics';
import {callIfFunction} from 'app/utils/callIfFunction';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import RequestError from 'app/utils/requestError/requestError';
import withApi from 'app/utils/withApi';
import withOrganizations from 'app/utils/withOrganizations';

const defaultProps = {
  detailed: true,
};

type Props = {
  api: Client;
  routes: PlainRoute[];
  includeSidebar: boolean;
  useLastOrganization: boolean;
  organizationsLoading: boolean;
  organizations: Organization[];
  detailed: boolean;
} & typeof defaultProps &
  RouteComponentProps<{orgId: string}, {}>;

type State = {
  organization: Organization | null;
  loading: boolean;
  dirty?: boolean;
  errorType?: string | null;
  error?: RequestError | null;
  hooks?: React.ReactNode[];
  prevProps: {
    orgId: string;
    organizationsLoading: boolean;
    location: RouteComponentProps<{orgId: string}, {}>['location'];
  };
};

class OrganizationContext extends React.Component<Props, State> {
  static getDerivedStateFromProps(props: Props, prevState: State): State {
    const {prevProps} = prevState;

    if (OrganizationContext.shouldRemount(prevProps, props)) {
      return OrganizationContext.getDefaultState(props);
    }

    const {organizationsLoading, location, params} = props;
    const {orgId} = params;
    return {
      ...prevState,
      prevProps: {
        orgId,
        organizationsLoading,
        location,
      },
    };
  }

  static shouldRemount(prevProps: State['prevProps'], props: Props): boolean {
    const hasOrgIdAndChanged =
      prevProps.orgId && props.params.orgId && prevProps.orgId !== props.params.orgId;

    const hasOrgId =
      props.params.orgId ||
      (props.useLastOrganization && ConfigStore.get('lastOrganization'));

    // protect against the case where we finish fetching org details
    // and then `OrganizationsStore` finishes loading:
    // only fetch in the case where we don't have an orgId
    //
    // Compare `getOrganizationSlug`  because we may have a last used org from server
    // if there is no orgId in the URL
    const organizationLoadingChanged =
      prevProps.organizationsLoading !== props.organizationsLoading &&
      props.organizationsLoading === false;

    return (
      hasOrgIdAndChanged ||
      (!hasOrgId && organizationLoadingChanged) ||
      (props.location.state === 'refresh' && prevProps.location.state !== 'refresh')
    );
  }

  static getDefaultState(props: Props): State {
    const prevProps = {
      orgId: props.params.orgId,
      organizationsLoading: props.organizationsLoading,
      location: props.location,
    };

    if (OrganizationContext.isOrgStorePopulatedCorrectly(props)) {
      // retrieve initial state from store
      return {
        ...OrganizationStore.get(),
        prevProps,
      };
    }

    return {
      loading: true,
      error: null,
      errorType: null,
      organization: null,
      prevProps,
    };
  }

  static getOrganizationSlug(props: Props) {
    return (
      props.params.orgId ||
      ((props.useLastOrganization &&
        (ConfigStore.get('lastOrganization') ||
          props.organizations?.[0]?.slug)) as string)
    );
  }

  static isOrgChanging(props: Props): boolean {
    const {organization} = OrganizationStore.get();

    if (!organization) {
      return false;
    }

    return organization.slug !== OrganizationContext.getOrganizationSlug(props);
  }

  static isOrgStorePopulatedCorrectly(props: Props) {
    const {detailed} = props;
    const {organization, dirty} = OrganizationStore.get();

    return (
      !dirty &&
      organization &&
      !OrganizationContext.isOrgChanging(props) &&
      (!detailed || (detailed && organization.projects && organization.teams))
    );
  }

  static propTypes = {
    api: PropTypes.object,
    routes: PropTypes.arrayOf(PropTypes.object),
    includeSidebar: PropTypes.bool,
    useLastOrganization: PropTypes.bool,
    organizationsLoading: PropTypes.bool,
    organizations: PropTypes.arrayOf(SentryTypes.Organization),
    detailed: PropTypes.bool,
  } as any;

  static childContextTypes = {
    organization: SentryTypes.Organization,
  };

  static defaultProps = defaultProps;

  constructor(props: Props) {
    super(props);
    this.state = OrganizationContext.getDefaultState(props);
  }

  getChildContext() {
    return {
      organization: this.state.organization,
    };
  }

  componentDidMount() {
    this.fetchData();
  }

  componentDidUpdate(prevProps: Props) {
    const remountPrevProps: State['prevProps'] = {
      orgId: prevProps.params.orgId,
      organizationsLoading: prevProps.organizationsLoading,
      location: prevProps.location,
    };

    if (OrganizationContext.shouldRemount(remountPrevProps, this.props)) {
      this.remountComponent();
    }
  }

  componentWillUnmount() {
    this.unlisteners.forEach(callIfFunction);
  }

  unlisteners = [
    ProjectActions.createSuccess.listen(() => this.onProjectCreation(), undefined),
    OrganizationStore.listen(data => this.loadOrganization(data), undefined),
  ];

  remountComponent = () => {
    this.setState(OrganizationContext.getDefaultState(this.props), this.fetchData);
  };

  onProjectCreation() {
    // If a new project was created, we need to re-fetch the
    // org details endpoint, which will propagate re-rendering
    // for the entire component tree
    fetchOrganizationDetails(
      this.props.api,
      OrganizationContext.getOrganizationSlug(this.props),
      true,
      true
    );
  }

  isLoading() {
    // In the absence of an organization slug, the loading state should be
    // derived from this.props.organizationsLoading from OrganizationsStore
    if (!OrganizationContext.getOrganizationSlug(this.props)) {
      return this.props.organizationsLoading;
    }
    // The following loading logic exists because we could either be waiting for
    // the whole organization object to come in or just the teams and projects.
    const {loading, error, organization} = this.state;
    const {detailed} = this.props;
    return (
      loading ||
      (!error &&
        detailed &&
        (!organization || !organization.projects || !organization.teams))
    );
  }

  fetchData() {
    if (!OrganizationContext.getOrganizationSlug(this.props)) {
      return;
    }
    // fetch from the store, then fetch from the API if necessary
    if (OrganizationContext.isOrgStorePopulatedCorrectly(this.props)) {
      return;
    }

    metric.mark({name: 'organization-details-fetch-start'});
    fetchOrganizationDetails(
      this.props.api,
      OrganizationContext.getOrganizationSlug(this.props),
      this.props.detailed,
      !OrganizationContext.isOrgChanging(this.props) // if true, will preserve a lightweight org that was fetched
    );
  }

  loadOrganization(orgData: State) {
    const {organization, error} = orgData;
    const hooks: React.ReactNode[] = [];

    if (organization && !error) {
      HookStore.get('organization:header').forEach(cb => {
        hooks.push(cb(organization));
      });

      // Configure scope to have organization tag
      Sentry.configureScope(scope => {
        // XXX(dcramer): this is duplicated in sdk.py on the backend
        scope.setTag('organization', organization.id);
        scope.setTag('organization.slug', organization.slug);
        scope.setContext('organization', {id: organization.id, slug: organization.slug});
      });
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
  }

  getOrganizationDetailsEndpoint() {
    return `/organizations/${OrganizationContext.getOrganizationSlug(this.props)}/`;
  }

  getTitle() {
    if (this.state.organization) {
      return this.state.organization.name;
    }
    return 'Sentry';
  }

  renderSidebar(): React.ReactNode {
    if (!this.props.includeSidebar) {
      return null;
    }

    const {children: _, ...props} = this.props;
    return <Sidebar {...props} organization={this.state.organization as Organization} />;
  }

  renderError() {
    let errorComponent: React.ReactElement;

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
  }

  render() {
    if (this.isLoading()) {
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
  }
}

export default withApi(withOrganizations(Sentry.withProfiler(OrganizationContext)));
export {OrganizationContext};

const ErrorWrapper = styled('div')`
  padding: ${space(3)};
`;
