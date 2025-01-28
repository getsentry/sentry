import type {Client} from 'sentry/api';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';

export async function updateDynamicSdkLoaderOptions({
  orgSlug,
  projectSlug,
  products,
  api,
  projectKey,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  projectKey: ProjectKey['id'];
  projectSlug: Project['slug'];
  products?: ProductSolution[];
}) {
  const newDynamicSdkLoaderOptions: ProjectKey['dynamicSdkLoaderOptions'] = {
    hasPerformance: false,
    hasReplay: false,
    hasDebug: false,
  };

  (products ?? []).forEach(product => {
    // eslint-disable-next-line default-case
    switch (product) {
      case ProductSolution.PERFORMANCE_MONITORING:
        newDynamicSdkLoaderOptions.hasPerformance = true;
        break;
      case ProductSolution.SESSION_REPLAY:
        newDynamicSdkLoaderOptions.hasReplay = true;
        break;
    }
  });

  try {
    await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/keys/${projectKey}/`, {
      method: 'PUT',
      data: {
        dynamicSdkLoaderOptions: newDynamicSdkLoaderOptions,
      },
    });
  } catch (error) {
    const message = t('Unable to dynamically update the SDK loader configuration');
    handleXhrErrorResponse(message, error);
  }
}
