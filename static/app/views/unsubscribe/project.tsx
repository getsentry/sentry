import {Fragment} from 'react';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {defaultFormOptions, useScrapsForm} from '@sentry/scraps/form';
import {Flex} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {NarrowLayout} from 'sentry/components/narrowLayout';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';

export default function UnsubscribeProject() {
  const location = useLocation();
  const signature = decodeScalar(location.query._);
  const params = useParams();
  return (
    <SentryDocumentTitle title={t('Unsubscribe')}>
      <NarrowLayout>
        <h3>{t('Unsubscribe')}</h3>
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
  const endpoint = getApiUrl(
    '/organizations/$organizationIdOrSlug/unsubscribe/project/$id/',
    {
      path: {organizationIdOrSlug: orgSlug, id: issueId},
    }
  );
  const {isPending, isError, data} = useQuery(
    apiOptions.as<UnsubscribeResponse>()(
      '/organizations/$organizationIdOrSlug/unsubscribe/project/$id/',
      {
        path: {organizationIdOrSlug: orgSlug, id: issueId},
        query: {_: signature},
        staleTime: 0,
      }
    )
  );
  const mutation = useMutation({
    mutationFn: (value: {cancel: number}) =>
      fetchMutation({url: `${endpoint}?_=${signature}`, method: 'POST', data: value}),
    onSuccess: () => {
      testableWindowLocation.assign('/auth/login/');
    },
  });
  const form = useScrapsForm({
    ...defaultFormOptions,
    defaultValues: {cancel: 1},
    onSubmit: ({value}) => mutation.mutateAsync(value).catch(() => {}),
  });

  if (isPending) {
    return <LoadingIndicator />;
  }
  if (isError) {
    return (
      <Alert.Container>
        <Alert variant="danger" showIcon={false}>
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
      <form.AppForm form={form}>
        <Flex gap="sm" justify="end">
          <Button
            onClick={() => {
              // Use window.location as we're going to an HTML view
              testableWindowLocation.assign('/auth/login/');
            }}
          >
            {t('Cancel')}
          </Button>
          <form.SubmitButton>{t('Unsubscribe')}</form.SubmitButton>
        </Flex>
      </form.AppForm>
    </Fragment>
  );
}
