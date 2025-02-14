import {Fragment} from 'react';

import {Alert} from 'sentry/components/alert';
import ApiForm from 'sentry/components/forms/apiForm';
import HiddenField from 'sentry/components/forms/fields/hiddenField';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NarrowLayout from 'sentry/components/narrowLayout';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t, tct} from 'sentry/locale';
import type {RouteComponentProps} from 'sentry/types/legacyReactRouter';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useParams} from 'sentry/utils/useParams';

type RouteParams = {
  id: string;
  orgId: string;
};

type Props = RouteComponentProps<RouteParams>;

function UnsubscribeIssue({location}: Props) {
  const signature = decodeScalar(location.query._);
  const params = useParams();
  return (
    <SentryDocumentTitle title={t('Issue Notification Unsubscribe')}>
      <NarrowLayout>
        <h3>{t('Issue Notification Unsubscribe')}</h3>
        <UnsubscribeBody
          signature={signature}
          orgSlug={params.orgId!}
          issueId={params.id!}
        />
      </NarrowLayout>
    </SentryDocumentTitle>
  );
}

interface UnsubscribeResponse {
  displayName: string;
  type: string;
  viewUrl: string;
}

type BodyProps = {
  issueId: string;
  orgSlug: string;
  signature?: string;
};

function UnsubscribeBody({orgSlug, issueId, signature}: BodyProps) {
  const endpoint = `/organizations/${orgSlug}/unsubscribe/issue/${issueId}/`;
  const {isPending, isError, data} = useApiQuery<UnsubscribeResponse>(
    [endpoint, {query: {_: signature}}],
    {staleTime: 0}
  );

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <Alert.Container>
        <Alert type="error">
          {t('There was an error loading unsubscribe data. Your link may have expired.')}
        </Alert>
      </Alert.Container>
    );
  }

  return (
    <Fragment>
      <p>
        <strong>{t('Account')}</strong>: {data.displayName}
      </p>
      <p>
        {tct('You are about to unsubscribe from [docsLink] for the [viewLink].', {
          docsLink: (
            <ExternalLink href="https://docs.sentry.io/workflow/notifications/workflow/">
              {t('workflow notifications')}
            </ExternalLink>
          ),
          viewLink: <Link to={data.viewUrl}>{t('selected %s', data.type)}</Link>,
        })}
      </p>
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

export default UnsubscribeIssue;
