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
import withOrganization from 'sentry/utils/withOrganization';

type OrganizationProps = {
  organization: Organization;
};

type BodyProps = {
  children?: React.ReactNode;
  // Organization can be null in account settings
  organization?: Organization;
};

function DeletionInProgress({organization}: OrganizationProps) {
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

function DeletionPending({organization}: OrganizationProps) {
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

function OrganizationDetailsBody({children, organization}: BodyProps) {
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
}

export default withOrganization(OrganizationDetailsBody);
