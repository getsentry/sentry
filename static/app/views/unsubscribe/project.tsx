import {Fragment} from 'react';
import {RouteComponentProps} from 'react-router';

import Alert from 'sentry/components/alert';
import ApiForm from 'sentry/components/forms/apiForm';
import HiddenField from 'sentry/components/forms/fields/hiddenField';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useParams} from 'sentry/utils/useParams';

type RouteParams = {
  id: string;
  orgId: string;
};

type Props = RouteComponentProps<RouteParams, {}>;

function UnsubscribeProject({location}: Props) {
  const signature = decodeScalar(location.query._);
  const params = useParams();
  return (
    <SentryDocumentTitle title={t('Unsubscribe')}>
      <NarrowLayout>
        <h3>{t('Unsubscribe')}</h3>
        <UnsubscribeBody
          signature={signature}
          orgSlug={params.orgId}
          issueId={params.id}
        />
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

interface UnsubscribeResponse {
  displayName: string;
  slug: string;
  type: string;
  viewUrl: string;
}

type BodyProps = {
  issueId: string;
  orgSlug: string;
  signature?: string;
};

function UnsubscribeBody({orgSlug, issueId, signature}: BodyProps) {
  const endpoint = `/organizations/${orgSlug}/unsubscribe/project/${issueId}/`;
  const {isLoading, isError, data} = useApiQuery<UnsubscribeResponse>(
    [endpoint, {query: {_: signature}}],
    {staleTime: 0}
  );

  if (isLoading) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <Alert type="error">
        {t('There was an error loading unsubscribe data. Your link may have expired.')}
      </Alert>
    );
  }

  return (
    <Fragment>
      <p>
        <strong>{t('Account')}</strong>: {data.displayName}
      </p>
      <p>
        {t(
          'You are about to unsubscribe from project notifications for the following project:'
        )}
      </p>
      <p>
        <strong>
          {orgSlug} / {data.slug}
        </strong>
      </p>
      <p>{t('You can subscribe to it again by going to your account settings.')}</p>
      <ApiForm
        apiEndpoint={`${endpoint}?_=${signature}`}
        apiMethod="POST"
        submitLabel={t('Unsubscribe')}
        cancelLabel={t('Cancel')}
        onCancel={() => {
          // Use window.location as we're going to an HTML view
          window.location.assign('/auth/login/');
        }}
        onSubmitSuccess={() => {
          // Use window.location as we're going to an HTML view
          window.location.assign('/auth/login/');
        }}
        initialData={{cancel: 1}}
      >
        <HiddenField name="cancel" />
      </ApiForm>
    </Fragment>
  );
}

export default UnsubscribeProject;
