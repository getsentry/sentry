import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import type {Client} from 'sentry/api';
import {ProductSolution} from 'sentry/components/onboarding/gettingStartedDoc/types';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project, ProjectKey} from 'sentry/types/project';
import {handleXhrErrorResponse} from 'sentry/utils/handleXhrErrorResponse';
import type RequestError from 'sentry/utils/requestError/requestError';

const PRODUCT_MESSAGES = {
  [ProductSolution.PERFORMANCE_MONITORING]: {
    enabled: t('Enabled Tracing in the Loader Script Config'),
    disabled: t('Disabled Tracing in the Loader Script Config'),
    enableError: t('Failed to enable Tracing in the Loader Script Config'),
    disableError: t('Failed to disable Tracing in the Loader Script Config'),
  },
  [ProductSolution.SESSION_REPLAY]: {
    enabled: t('Enabled Session Replay in the Loader Script Config'),
    disabled: t('Disabled Session Replay in the Loader Script Config'),
    enableError: t('Failed to enable Session Replay in the Loader Script Config'),
    disableError: t('Failed to disable Session Replay in the Loader Script Config'),
  },
  [ProductSolution.PROFILING]: {
    enabled: t('Enabled Profiling in the Loader Script Config'),
    disabled: t('Disabled Profiling in the Loader Script Config'),
    enableError: t('Failed to enable Profiling in the Loader Script Config'),
    disableError: t('Failed to disable Profiling in the Loader Script Config'),
  },
};

function addProductMessage(
  products: ProductSolution[],
  previousProducts?: ProductSolution[],
  isError = false
) {
  if (!previousProducts) {
    return;
  }

  const previousSet = new Set(previousProducts);

  const toggledProduct =
    products.find(product => !previousSet.has(product)) ||
    previousProducts.find(product => !new Set(products).has(product));

  if (!toggledProduct) {
    return;
  }

  const messages = PRODUCT_MESSAGES[toggledProduct as keyof typeof PRODUCT_MESSAGES];

  if (!messages) {
    return;
  }

  const isEnabled = products.includes(toggledProduct);

  if (isError) {
    addErrorMessage(isEnabled ? messages.enableError : messages.disableError);
  } else {
    addSuccessMessage(isEnabled ? messages.enabled : messages.disabled);
  }
}

export async function updateDynamicSdkLoaderOptions({
  orgSlug,
  projectSlug,
  products,
  api,
  projectKey,
  previousProducts,
}: {
  api: Client;
  orgSlug: Organization['slug'];
  products: ProductSolution[];
  projectKey: ProjectKey['id'];
  projectSlug: Project['slug'];
  previousProducts?: ProductSolution[];
}) {
  try {
    await api.requestPromise(`/projects/${orgSlug}/${projectSlug}/keys/${projectKey}/`, {
      method: 'PUT',
      data: {
        dynamicSdkLoaderOptions: {
          hasPerformance: products.includes(ProductSolution.PERFORMANCE_MONITORING),
          hasReplay: products.includes(ProductSolution.SESSION_REPLAY),
          hasDebug: false,
        },
      },
    });

    addProductMessage(products, previousProducts);
  } catch (error) {
    addProductMessage(products, previousProducts, true);

    handleXhrErrorResponse(
      'Unable to dynamically update the SDK loader configuration',
      error as RequestError
    );
  }
}
