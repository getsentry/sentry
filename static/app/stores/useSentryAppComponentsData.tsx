import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

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
  if (installs) {
    SentryAppInstallationStore.load(installs);
  }

  const {data: components} = useApiQuery<SentryAppComponent[]>(
    [`/organizations/${organization.slug}/sentry-app-components/`, {query: {projectId}}],
    {enabled: Boolean(projectId), staleTime: Infinity}
  );
  if (components) {
    SentryAppComponentsStore.loadComponents(components);
  }

  useEffect(() => {
    if (!projectId) {
      Sentry.withScope(scope => {
        scope.setExtra('orgSlug', organization.slug);
        scope.setExtra('projectId', projectId);
        Sentry.captureMessage('Project ID was not set');
      });
    }
  }, [organization.slug, projectId]);
}
