import {useEffect} from 'react';

import SentryAppComponentsStore from 'sentry/stores/sentryAppComponentsStore';
import SentryAppInstallationStore from 'sentry/stores/sentryAppInstallationsStore';
import {SentryAppComponent, SentryAppInstallation} from 'sentry/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectId: string;
}

export default function useSentryAppComponentsData({projectId}: Props) {
  const organization = useOrganization();

  const {data: installs} = useApiQuery<SentryAppInstallation[]>(
    [`/organizations/${organization.slug}/sentry-app-installations/`],
    {staleTime: Infinity}
  );
  useEffect(() => {
    if (installs) {
      SentryAppInstallationStore.load(installs);
    }
  }, [installs]);

  const {data: components} = useApiQuery<SentryAppComponent[]>(
    [`/organizations/${organization.slug}/sentry-app-components/`, {query: {projectId}}],
    {enabled: Boolean(projectId), staleTime: Infinity}
  );
  useEffect(() => {
    if (components) {
      SentryAppComponentsStore.loadComponents(components);
    }
  }, [components]);
}
