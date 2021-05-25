import {Component, Fragment} from 'react';
import {browserHistory, RouteComponentProps} from 'react-router';

import {switchOrganization} from 'app/actionCreators/organizations';
import AlertActions from 'app/actions/alertActions';
import {Client} from 'app/api';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ErrorBoundary from 'app/components/errorBoundary';
import Footer from 'app/components/footer';
import {Body, Main} from 'app/components/layouts/thirds';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import getRouteStringFromRoutes from 'app/utils/getRouteStringFromRoutes';
import withOrganization from 'app/utils/withOrganization';
import OrganizationContext from 'app/views/organizationContext';

type InProgressProps = {
  organization: Organization;
};

function DeletionInProgress({organization}: InProgressProps) {
  return (
    <Body>
      <Main>
        <Alert type="warning" icon={<IconWarning />}>
          {tct(
            'The [organization] organization is currently in the process of being deleted from Sentry.',
            {
              organization: <strong>{organization.slug}</strong>,
            }
          )}
        </Alert>
      </Main>
    </Body>
  );
}

type PendingProps = {
  organization: Organization;
};

type PendingState = {
  submitInProgress: boolean;
};

class DeletionPending extends Component<PendingProps, PendingState> {
  state: PendingState = {submitInProgress: false};

  componentWillUnmount() {
    this.api.clear();
  }

  api = new Client();

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
      <Body>
        <Main>
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
        </Main>
      </Body>
    );
  }
}

type OrganizationDetailsProps = {
  organization?: Organization;
  children?: React.ReactNode;
};

const OrganizationDetailsBody = withOrganization(function OrganizationDetailsBody({
  children,
  organization,
}: OrganizationDetailsProps) {
  const status = organization?.status?.id;
  if (organization && status === 'pending_deletion') {
    return <DeletionPending organization={organization} />;
  }
  if (organization && status === 'deletion_in_progress') {
    return <DeletionInProgress organization={organization} />;
  }
  return (
    <Fragment>
      <ErrorBoundary>{children}</ErrorBoundary>
      <Footer />
    </Fragment>
  );
});

type Props = {
  detailed: boolean;
} & RouteComponentProps<{orgId: string}, {}>;

export default class OrganizationDetails extends Component<Props> {
  componentDidMount() {
    const {routes} = this.props;
    const isOldRoute = getRouteStringFromRoutes(routes) === '/:orgId/';

    if (isOldRoute) {
      browserHistory.replace(`/organizations/${this.props.params.orgId}/`);
    }
  }

  componentDidUpdate(prevProps: Props) {
    if (
      prevProps.params &&
      this.props.params &&
      prevProps.params.orgId !== this.props.params.orgId
    ) {
      switchOrganization();
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

export function LightWeightOrganizationDetails(props: Omit<Props, 'detailed'>) {
  return <OrganizationDetails detailed={false} {...props} />;
}
