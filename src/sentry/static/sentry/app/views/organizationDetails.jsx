import React, {Component} from 'react';
import PropTypes from 'prop-types';

import AlertActions from 'app/actions/alertActions';
import ErrorBoundary from 'app/components/errorBoundary';
import Button from 'app/components/buttons/button';
import {Client} from 'app/api';
import OrganizationContext from 'app/views/organizationContext';
import NarrowLayout from 'app/components/narrowLayout';
import Footer from 'app/components/footer';
import LazyLoad from 'app/components/lazyLoad';
import OldSidebar from 'app/components/sidebar.old'; // #NEW-SETTINGS
import {t, tct} from 'app/locale';

class DeletionInProgress extends Component {
  static propTypes = {
    organization: PropTypes.object.isRequired,
  };

  render() {
    let {organization} = this.props;
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
    organization: PropTypes.object.isRequired,
  };

  constructor(...args) {
    super(...args);
    this.state = {submitInProgress: false};
  }

  componentWillMount() {
    this.api = new Client();
  }

  componentWillUnmount() {
    this.api.clear();
  }

  onRestore = () => {
    if (this.state.submitInProgress) return;
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
    let {organization} = this.props;
    let access = new Set(organization.access);
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
    organization: PropTypes.object.isRequired,
  };

  render() {
    let {organization} = this.context;
    let hasNewDashboardFeatures =
      organization && organization.features.indexOf('dashboard') > -1;

    if (organization.status)
      if (organization.status.id === 'pending_deletion') {
        return <DeletionPending organization={organization} />;
      } else if (organization.status.id === 'deletion_in_progress') {
        return <DeletionInProgress organization={organization} />;
      }
    return (
      <React.Fragment>
        {hasNewDashboardFeatures ? (
          <LazyLoad
            component={() =>
              import(/*webpackChunkName: "NewSidebar"*/ 'app/components/sidebar').then(
                mod => mod.default
              )}
            {...this.props}
            organization={organization}
          />
        ) : (
          <OldSidebar />
        )}
        <ErrorBoundary>{this.props.children}</ErrorBoundary>
        <Footer />
      </React.Fragment>
    );
  }
}

export default class OrganizationDetails extends Component {
  render() {
    return (
      <OrganizationContext {...this.props}>
        <OrganizationDetailsBody>{this.props.children}</OrganizationDetailsBody>
      </OrganizationContext>
    );
  }
}
