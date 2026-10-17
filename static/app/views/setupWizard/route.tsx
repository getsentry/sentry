import {useEffect, useRef} from 'react';
import {IconSentry} from '@sentry/icons/sentry';
import {useMutation, useQuery} from '@tanstack/react-query';

import {Stack} from '@sentry/scraps/layout';

import {BrandPageLayout} from 'sentry/components/brandPageLayout';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {SentryDocumentTitle} from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {fetchMutation} from 'sentry/utils/queryClient';
import {testableWindowLocation} from 'sentry/utils/testableWindowLocation';
import {useLocation} from 'sentry/utils/useLocation';
import {useParams} from 'sentry/utils/useParams';
import SetupWizard from 'sentry/views/setupWizard';
import type {WizardSession} from 'sentry/views/setupWizard/types';

function WizardSessionContent({hash}: {hash: string}) {
  const {query} = useLocation();
  const session = useQuery({
    ...apiOptions.as<WizardSession>()('/wizard/$wizardHash/session/', {
      path: {wizardHash: hash},
      query,
      staleTime: 0,
    }),
    retry: false,
    refetchOnWindowFocus: false,
  });
  const organizationSlug =
    typeof query.org_slug === 'string' ? query.org_slug : undefined;
  const projectSlug =
    typeof query.project_slug === 'string' ? query.project_slug : undefined;
  const hasPreselection = Boolean(organizationSlug && projectSlug);
  const attemptedInitialization = useRef(false);
  const {
    mutate: initialize,
    data: initializedSession,
    isIdle,
    isPending: isInitializing,
    isError: isInitializationError,
  } = useMutation({
    mutationFn: () =>
      fetchMutation<WizardSession>({
        url: getApiUrl('/wizard/$wizardHash/session/', {path: {wizardHash: hash}}),
        method: 'POST',
        data: {organizationSlug, projectSlug},
      }),
  });

  useEffect(() => {
    if (
      session.data?.status !== 'pending' ||
      !hasPreselection ||
      attemptedInitialization.current
    ) {
      return;
    }

    attemptedInitialization.current = true;
    initialize();
  }, [session.data?.status, hasPreselection, initialize]);

  const state = initializedSession ?? session.data;

  useEffect(() => {
    if (state?.status === 'unauthenticated') {
      testableWindowLocation.assign(state.redirectUrl);
    }
  }, [state]);

  if (session.isError || isInitializationError) {
    return (
      <LoadingError
        message={t('Failed to load wizard session')}
        onRetry={() => (isInitializationError ? initialize() : session.refetch())}
      />
    );
  }

  if (
    !state ||
    state.status === 'unauthenticated' ||
    (state.status === 'pending' && hasPreselection && (isIdle || isInitializing))
  ) {
    return <LoadingIndicator />;
  }

  if (state.status === 'expired') {
    return (
      <LoadingError
        message={t('This setup session has expired. Run the wizard again.')}
      />
    );
  }

  return <SetupWizard hash={hash} enableProjectSelection={state.status === 'pending'} />;
}

export default function SetupWizardRoute() {
  const {wizardHash} = useParams<{wizardHash: string}>();

  return (
    <SentryDocumentTitle title={t('Setup Wizard')}>
      <BrandPageLayout>
        <BrandPageLayout.HeaderStart>
          <IconSentry size="xl" />
        </BrandPageLayout.HeaderStart>
        <BrandPageLayout.Content>
          <Stack justify="center" flex="1" padding="2xl 0">
            <WizardSessionContent key={wizardHash} hash={wizardHash} />
          </Stack>
        </BrandPageLayout.Content>
      </BrandPageLayout>
    </SentryDocumentTitle>
  );
}
