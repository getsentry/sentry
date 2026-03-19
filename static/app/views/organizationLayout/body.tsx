import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';

import * as Layout from 'sentry/components/layouts/thirds';
import {t, tct} from 'sentry/locale';
import {AlertStore} from 'sentry/stores/alertStore';
import type {Organization} from 'sentry/types/organization';
import {useMutation} from 'sentry/utils/queryClient';
import {useApi} from 'sentry/utils/useApi';

interface OrganizationDeletionInProgressProps {
  organization: Organization;
}

function OrganizationDeletionInProgress(props: OrganizationDeletionInProgressProps) {
  return (
    <Layout.Body>
      <Layout.Main>
        <Alert.Container>
          <Alert variant="warning">
            {tct(
              'The [organization] organization is currently in the process of being deleted from Sentry.',
              {
                organization: <strong>{props.organization.slug}</strong>,
              }
            )}
          </Alert>
        </Alert.Container>
      </Layout.Main>
    </Layout.Body>
  );
}

interface OrganizatonDeletionPendingProps {
  organization: Organization;
}

function OrganizationDeletionPending(props: OrganizatonDeletionPendingProps) {
  const api = useApi();

  const {mutate: onRestore, isPending: isRestoring} = useMutation({
    mutationFn: () =>
      api.requestPromise(`/organizations/${props.organization?.slug}/`, {
        method: 'PUT',
        data: {cancelDeletion: true},
      }),
    onSuccess: () => window.location.reload(),
    onError: () => {
      AlertStore.addAlert({
        message:
          'We were unable to restore this organization. Please try again or contact support.',
        variant: 'danger',
      });
    },
  });

  return (
    <Layout.Body>
      <Layout.Main>
        <h3>{t('Deletion Scheduled')}</h3>
        <p>
          {tct('The [organization] organization is currently scheduled for deletion.', {
            organization: <strong>{props.organization.slug}</strong>,
          })}
        </p>

        {props.organization.access.includes('org:admin') ? (
          <div>
            <p>
              {t(
                'Would you like to cancel this process and restore the organization back to the original state?'
              )}
            </p>
            <p>
              <Button
                priority="primary"
                onClick={() => onRestore()}
                disabled={isRestoring}
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
      </Layout.Main>
    </Layout.Body>
  );
}
