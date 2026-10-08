import {Fragment, type ReactNode} from 'react';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {Button} from '@sentry/scraps/button';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Heading, Text} from '@sentry/scraps/text';

import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import SuperuserStaffAccessForm from 'sentry/components/superuserStaffAccessForm';
import {ThemeAndStyleProvider} from 'sentry/components/themeAndStyleProvider';
import {ScrapsProviders} from 'sentry/scrapsProviders';
import {ConfigStore} from 'sentry/stores/configStore';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';

export function AdminAccessGate({children}: {children: ReactNode}) {
  const check = useQuery({
    ...apiOptions.as<null>()('/_admin/superuser-check/', {staleTime: 0}),
    retry: false,
  });
  const mode = ConfigStore.get('getsentry.adminAccessMode');
  const status = check.error instanceof RequestError ? check.error.status : undefined;

  if (check.isSuccess) {
    return children;
  }

  return (
    <ThemeAndStyleProvider>
      <ScrapsProviders>
        <Flex justify="center" padding="3xl xl">
          <Stack width="100%" maxWidth="600px" gap="xl">
            {check.isPending ? (
              <LoadingIndicator />
            ) : status === 403 && mode ? (
              <Fragment>
                <Heading as="h1">
                  {mode === 'staff' ? 'Admin access' : 'Superuser access'}
                </Heading>
                <Text as="p">
                  {mode === 'staff'
                    ? 'Authenticate with your security key to access admin.'
                    : 'Select your reason for using superuser access.'}
                </Text>
                <SuperuserStaffAccessForm hasStaff={mode === 'staff'} />
              </Fragment>
            ) : status === 401 ? (
              <Fragment>
                <Alert variant="warning">Sign in to access admin.</Alert>
                <Button onClick={() => testableWindowLocation.reload()}>Sign in</Button>
              </Fragment>
            ) : (
              <Fragment>
                <Alert variant="danger">Unable to verify admin access.</Alert>
                <Button onClick={() => check.refetch()}>Try again</Button>
              </Fragment>
            )}
          </Stack>
        </Flex>
      </ScrapsProviders>
    </ThemeAndStyleProvider>
  );
}
