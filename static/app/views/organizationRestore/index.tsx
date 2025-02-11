import {Fragment} from 'react';
import styled from '@emotion/styled';

import {addSuccessMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/alert';
import {Button} from 'sentry/components/button';
import ApiForm from 'sentry/components/forms/apiForm';
import HiddenField from 'sentry/components/forms/fields/hiddenField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import type {Organization} from 'sentry/types/organization';
import {browserHistory} from 'sentry/utils/browserHistory';
import {useApiQuery} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import {useParams} from 'sentry/utils/useParams';

type Props = RouteComponentProps<{orgId: string}, {}>;

function OrganizationRestore(_props: Props) {
  const params = useParams<{orgId: string}>();
  return (
    <SentryDocumentTitle title={t('Restore Organization')}>
      <NarrowLayout>
        <h3>{t('Deletion Scheduled')}</h3>
        <OrganizationRestoreBody orgSlug={params.orgId} />
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

type BodyProps = {
  orgSlug: string;
};

function OrganizationRestoreBody({orgSlug}: BodyProps) {
  const endpoint = `/organizations/${orgSlug}/`;
  const {isPending, isError, data} = useApiQuery<Organization>([endpoint], {
    staleTime: 0,
  });
  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <Alert type="error">{t('There was an error loading your organization.')}</Alert>
    );
  }
  if (data.status.id === 'active') {
    browserHistory.replace(normalizeUrl(`/organizations/${orgSlug}/issues/`));
    return null;
  }
  if (data.status.id === 'pending_deletion') {
    return <RestoreForm organization={data} endpoint={endpoint} />;
  }
  return (
    <p>
      {t(
        'Sorry, but this organization is currently in progress of being deleted. No turning back.'
      )}
    </p>
  );
}

type RestoreFormProps = {
  endpoint: string;
  organization: Organization;
};

function RestoreForm({endpoint, organization}: RestoreFormProps) {
  return (
    <Fragment>
      <ApiForm
        apiEndpoint={endpoint}
        apiMethod="PUT"
        submitLabel={t('Restore Organization')}
        onSubmitSuccess={() => {
          addSuccessMessage(t('Organization Restored'));

          // Use window.location to ensure page reloads
          window.location.assign(
            normalizeUrl(`/organizations/${organization.slug}/issues/`)
          );
        }}
        initialData={{cancelDeletion: 1}}
        hideFooter
      >
        <HiddenField name="cancelDeletion" />
        <p>
          {tct('The [name] organization is currently scheduled for deletion.', {
            name: <strong>{organization.slug}</strong>,
          })}
        </p>
        <p>
          {t(
            'Would you like to cancel this process and restore the organization back to the original state?'
          )}
        </p>
        <ButtonWrapper>
          <Button data-test-id="form-submit" priority="primary" type="submit">
            {t('Restore Organization')}
          </Button>
        </ButtonWrapper>
      </ApiForm>
      <p>
        {t(
          'Note: Restoration is available until deletion has started. Once it begins, there is no recovering the data that has been removed.'
        )}
      </p>
    </Fragment>
  );
}

const ButtonWrapper = styled('div')`
  margin-bottom: ${space(2)};
`;

export default OrganizationRestore;
