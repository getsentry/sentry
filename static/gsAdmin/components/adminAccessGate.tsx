import {Fragment, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

export function AdminAccessGate({children}: {children: ReactNode}) {
  const check = useQuery({
    ...apiOptions.as<null>()('/_admin/superuser-check/', {
      staleTime: 0,
      allowAuthError: true,
    }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const status = check.error instanceof RequestError ? check.error.status : undefined;

  if (check.isSuccess) {
    return children;
  }

  return (
    <Flex justify="center" padding="3xl xl">
      <Stack width="100%" maxWidth="600px" gap="xl">
        {check.isPending ? (
          <LoadingIndicator />
        ) : status === 401 ? (
          <Fragment>
            <Alert variant="warning">Sign in to access admin.</Alert>
            <Button onClick={() => testableWindowLocation.reload()}>Sign in</Button>
          </Fragment>
        ) : status === 403 ? (
          <Fragment>
            <Alert variant="warning">Authenticate to access admin.</Alert>
            <Button onClick={() => check.refetch()}>Authenticate</Button>
          </Fragment>
        ) : (
          <Fragment>
            <Alert variant="danger">Unable to verify admin access.</Alert>
            <Button onClick={() => check.refetch()}>Try again</Button>
          </Fragment>
        )}
      </Stack>
    </Flex>
  );
}
