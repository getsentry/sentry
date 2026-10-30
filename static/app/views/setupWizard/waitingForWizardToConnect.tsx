import {useEffect} from 'react';
import styled from '@emotion/styled';
import {IconCheckmark} from '@sentry/icons/checkmark';
import {useQuery} from '@tanstack/react-query';

import {Flex} from '@sentry/scraps/layout';

import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {OrganizationSummary} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import type {WizardSession} from 'sentry/views/setupWizard/types';
import {useSetupWizardCompletedAnalytics} from 'sentry/views/setupWizard/utils/setupWizardAnalytics';

export function WaitingForWizardToConnect({
  hash,
  organizations,
}: {
  hash: string;
  organizations: OrganizationSummary[];
}) {
  const session = useQuery({
    ...apiOptions.as<WizardSession>()('/wizard/$wizardHash/session/', {
      path: {wizardHash: hash},
      staleTime: 0,
    }),
    retry: false,
    refetchOnWindowFocus: false,
    refetchInterval: query =>
      query.state.data?.json.status === 'selected' ? 1000 : false,
  });
  const finished = session.data?.status === 'completed';
  const trackWizardCompleted = useSetupWizardCompletedAnalytics(organizations);

  useEffect(() => {
    if (!finished) {
      return;
    }

    trackWizardCompleted();
    const closeTimeout = window.setTimeout(() => window.close(), 10000);
    return () => window.clearTimeout(closeTimeout);
  }, [finished, trackWizardCompleted]);

  useEffect(() => {
    if (session.data?.status === 'unauthenticated') {
      testableWindowLocation.assign(session.data.redirectUrl);
    }
  }, [session.data]);

  if (session.isError) {
    return (
      <LoadingError
        message={t('Failed to load wizard session')}
        onRetry={session.refetch}
      />
    );
  }

  if (session.data?.status === 'expired') {
    return (
      <LoadingError
        message={t('This setup session has expired. Run the wizard again.')}
      />
    );
  }

  return finished ? (
    <Flex align="center" gap="2xl">
      <SuccessCheckmark variant="success" size="xl" />
      <SuccessHeading>
        {t('Return to your terminal to complete your setup.')}
      </SuccessHeading>
    </Flex>
  ) : (
    <LoadingIndicator style={{margin: '2em auto'}}>
      <h5>{t('Waiting for wizard to connect')}</h5>
    </LoadingIndicator>
  );
}

const SuccessCheckmark = styled(IconCheckmark)`
  flex-shrink: 0;
`;

const SuccessHeading = styled('h5')`
  margin: 0;
`;
