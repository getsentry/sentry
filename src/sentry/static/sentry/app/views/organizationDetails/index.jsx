import {Fragment, Component} from 'react';
import {browserHistory} from 'react-router';
import PropTypes from 'prop-types';

import {Client} from 'app/api';
import {switchOrganization} from 'app/actionCreators/organizations';
import {t, tct} from 'app/locale';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import AlertActions from 'app/actions/alertActions';
import Button from 'app/components/button';
import ErrorBoundary from 'app/components/errorBoundary';
import Footer from 'app/components/footer';
import NarrowLayout from 'app/components/narrowLayout';
import OrganizationContext from 'app/views/organizationContext';
import SentryTypes from 'app/sentryTypes';

class DeletionInProgress extends Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  render() {
    const {organization} = this.props;
    return (
      <NarrowLayout>
        <p>
          {tct(
            'The [organization] organization is currently in the process of being deleted from Sentry.',
            {
              organization: <strong>{organization.slug}</strong>,
            }
          )}
        </p>
      </NarrowLayout>
    );
  }
}

class DeletionPending extends Component {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {submitInProgress: false};
  }

  UNSAFE_componentWillMount() {
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onRestore = () => {
    if (this.state.submitInProgress) {
      return;
    }
    this.setState({submitInProgress: true});
    this.api.request(`/organizations/${this.props.organization.slug}/`, {
      method: 'PUT',
      data: {cancelDeletion: true},
      success: () => {
        window.location.reload();
      },
      error: () => {
        AlertActions.addAlert({
          message:
            'We were unable to restore this organization. Please try again or contact support.',
          type: 'error',
        });
        this.setState({submitInProgress: false});
      },
    });
  };

  render() {
    const {organization} = this.props;
    const access = new Set(organization.access);
    return (
      <NarrowLayout>
        <h3>{t('Deletion Scheduled')}</h3>
        <p>
          {tct('The [organization] organization is currently scheduled for deletion.', {
            organization: <strong>{organization.slug}</strong>,
          })}
        </p>

        {access.has('org:admin') ? (
          <div>
            <p>
              {t(
                'Would you like to cancel this process and restore the organization back to the original state?'
              )}
            </p>
            <p>
              <Button
                priority="primary"
                onClick={this.onRestore}
                disabled={this.state.submitInProgress}
              >
                {t('Restore Organization')}
              </Button>
            </p>
          </div>
        ) : (
          <p>
            {t(
              'If this is a mistake, contact an organization owner and ask them to restore this organization.'
            )}
          </p>
        )}
        <p>
          <small>
            {t(
              "Note: Restoration is available until the process begins. Once it does, there's no recovering the data that has been removed."
            )}
          </small>
        </p>
      </NarrowLayout>
    );
  }
}

class OrganizationDetailsBody extends Component {
  static contextTypes = {
    organization: SentryTypes.Organization,
  };

  render() {
    const {organization} = this.context;

    if (organization && organization.status) {
      if (organization.status.id === 'pending_deletion') {
        return <DeletionPending organization={organization} />;
      } else if (organization.status.id === 'deletion_in_progress') {
        return <DeletionInProgress organization={organization} />;
      }
    }
    return (
      <Fragment>
        <ErrorBoundary>{this.props.children}</ErrorBoundary>
        <Footer />
      </Fragment>
    );
  }
}

export default class OrganizationDetails extends Component {
  static propTypes = {
    routes: PropTypes.array,
  };

  componentDidMount() {
    const {routes} = this.props;
    const isOldRoute = getRouteStringFromRoutes(routes) === '/:orgId/';

    if (isOldRoute) {
      browserHistory.replace(`/organizations/${this.props.params.orgId}/`);
    }
  }

  componentDidUpdate(prevProps) {
    if (
      prevProps.params &&
      this.props.params &&
      prevProps.params.orgId !== this.props.params.orgId
    ) {
      switchOrganization(prevProps.params.orgId, this.props.params.orgId);
    }
  }
  render() {
    return (
      <OrganizationContext includeSidebar useLastOrganization {...this.props}>
        <OrganizationDetailsBody {...this.props}>
          {this.props.children}
        </OrganizationDetailsBody>
      </OrganizationContext>
    );
  }
}

export function LightWeightOrganizationDetails(props) {
  return <OrganizationDetails detailed={false} {...props} />;
}
