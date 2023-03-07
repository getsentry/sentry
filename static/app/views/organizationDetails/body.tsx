import {Fragment, useState} from 'react';

import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Footer from 'sentry/components/footer';
import * as Layout from 'sentry/components/layouts/thirds';
import {t, tct} from 'sentry/locale';
import AlertStore from 'sentry/stores/alertStore';
import {Organization} from 'sentry/types';
import useApi from 'sentry/utils/useApi';
import {useRouteContext} from 'sentry/utils/useRouteContext';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function DeletionInProgress({organization}: Props) {
  return (
    <Layout.Body>
      <Layout.Main>
        <Alert type="warning" showIcon>
          {tct(
            'The [organization] organization is currently in the process of being deleted from Sentry.',
            {
              organization: <strong>{organization.slug}</strong>,
            }
          )}
        </Alert>
      </Layout.Main>
    </Layout.Body>
  );
}

function DeletionPending({organization}: Props) {
  const api = useApi();
  const [isRestoring, setIsRestoring] = useState(false);

  const onRestore = async () => {
    setIsRestoring(true);

    try {
      await api.requestPromise(`/organizations/${organization.slug}/`, {
        method: 'PUT',
        data: {cancelDeletion: true},
      });
      window.location.reload();
    } catch {
      setIsRestoring(false);
      AlertStore.addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        type: 'error',
      });
    }
  };

  return (
    <Layout.Body>
      <Layout.Main>
        <h3>{t('Deletion Scheduled')}</h3>
        <p>
          {tct('The [organization] organization is currently scheduled for deletion.', {
            organization: <strong>{organization.slug}</strong>,
          })}
        </p>

        {organization.access.includes('org:admin') ? (
          <div>
            <p>
              {t(
                'Would you like to cancel this process and restore the organization back to the original state?'
              )}
            </p>
            <p>
              <Button priority="primary" onClick={onRestore} disabled={isRestoring}>
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
      </Layout.Main>
    </Layout.Body>
  );
}

function OrganizationDetailsBody({children, organization}: Props) {
  const status = organization?.status?.id;
  const routeContext = useRouteContext();

  if (status === 'pending_deletion') {
    return <DeletionPending organization={organization} />;
  }

  if (status === 'deletion_in_progress') {
    return <DeletionInProgress organization={organization} />;
  }

  const heartbeatFooter = !!organization?.features.includes(
    'onboarding-heartbeat-footer'
  );

  const gettingStartedRoutes = [
    `/getting-started/${routeContext.params.projectId}/${routeContext.params.platform}/`,
    `/${organization.slug}/${routeContext.params.projectId}/getting-started/${routeContext.params.platform}/`,
  ];

  const onboardingRoutes = [
    `/onboarding/welcome/`,
    `/onboarding/setup-docs/`,
    `/onboarding/select-platform/`,
    `/onboarding/${organization.slug}/welcome/`,
    `/onboarding/${organization.slug}/setup-docs/`,
    `/onboarding/${organization.slug}/select-platform/`,
  ];

  const showFooter = !heartbeatFooter
    ? true
    : !gettingStartedRoutes.includes(routeContext.location.pathname) &&
      !onboardingRoutes.includes(routeContext.location.pathname);

  return (
    <Fragment>
      <ErrorBoundary>{children}</ErrorBoundary>
      {showFooter && <Footer />}
    </Fragment>
  );
}

export default withOrganization(OrganizationDetailsBody);
