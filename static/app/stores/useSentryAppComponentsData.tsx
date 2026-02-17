import {useEffect} from 'react';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import type {SentryAppComponent, SentryAppInstallation} from 'sentry/types/integrations';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectId: string | undefined;
}

export default function useSentryAppComponentsData({projectId}: Props) {
  const organization = useOrganization();

  const {data: installs} = useApiQuery<SentryAppInstallation[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sentry-app-installations/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
    ],
    {staleTime: Infinity}
  );
  useEffect(() => {
    if (installs) {
      SentryAppInstallationStore.load(installs);
    }
  }, [installs]);

  const {data: components} = useApiQuery<SentryAppComponent[]>(
    [
      getApiUrl('/organizations/$organizationIdOrSlug/sentry-app-components/', {
        path: {organizationIdOrSlug: organization.slug},
      }),
      {query: {projectId: projectId!}},
    ],
    {enabled: Boolean(projectId), staleTime: Infinity}
  );
  useEffect(() => {
    if (components) {
      SentryAppComponentsStore.loadComponents(components);
    }
  }, [components]);
}
