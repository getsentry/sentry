import {useEffect} from 'react';
import * as Sentry from '@sentry/react';

import {fetchSentryAppComponents} from 'sentry/actionCreators/sentryAppComponents';
import fetchSentryAppInstallations from 'sentry/utils/fetchSentryAppInstallations';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';

interface Props {
  projectId: string;
}

export default function useSentryAppComponentsData({projectId}: Props) {
  const api = useApi();
  const organization = useOrganization();

  useEffect(() => {
    fetchSentryAppInstallations(api, organization.slug);
    // TODO(marcos): Sometimes PageFiltersStore cannot pick a project.
    if (projectId) {
      fetchSentryAppComponents(api, organization.slug, projectId);
    } else {
      Sentry.withScope(scope => {
        scope.setExtra('orgSlug', organization.slug);
        scope.setExtra('projectId', projectId);
        Sentry.captureMessage('Project ID was not set');
      });
    }
  }, [api, organization.slug, projectId]);
}
