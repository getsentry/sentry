import {Fragment, useState} from 'react';

import AlertActions from 'app/actions/alertActions';
import Alert from 'app/components/alert';
import Button from 'app/components/button';
import ErrorBoundary from 'app/components/errorBoundary';
import Footer from 'app/components/footer';
import {Body, Main} from 'app/components/layouts/thirds';
import {IconWarning} from 'app/icons';
import {t, tct} from 'app/locale';
import {Organization} from 'app/types';
import useApi from 'app/utils/useApi';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  children?: React.ReactNode;
};

function DeletionInProgress({organization}: Props) {
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
      AlertActions.addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        type: 'error',
      });
    }
  };

  return (
    <Body>
      <Main>
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
      </Main>
    </Body>
  );
}

function OrganizationDetailsBody({children, organization}: Props) {
  const status = organization?.status?.id;

  if (status === 'pending_deletion') {
    return <DeletionPending organization={organization} />;
  }

  if (status === 'deletion_in_progress') {
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
