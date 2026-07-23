import {useEffect, useMemo, useRef, useState} from 'react';
import {type AriaComboBoxProps} from '@react-aria/combobox';

import {Stack} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {
  AskSeerComboBox,
  type AskSeerComboBoxProps,
} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerComboBox';
import {AskSeerLoadingStatus} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerLoadingStatus';
import {AskSeerProgressBlocks} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerProgressBlocks';
import {AskSeerSearchHeader} from 'sentry/components/searchQueryBuilder/askSeerCombobox/askSeerSearchHeader';
import {BaseAskSeerComboBox} from 'sentry/components/searchQueryBuilder/askSeerCombobox/baseAskSeerComboBox';
import type {QueryTokensProps} from 'sentry/components/searchQueryBuilder/askSeerCombobox/types';
import {useAskSeerPolling} from 'sentry/components/searchQueryBuilder/askSeerCombobox/useAskSeerPolling';
import {formatQueryToNaturalLanguage} from 'sentry/components/searchQueryBuilder/askSeerCombobox/utils';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';

interface AskSeerPollingComboBoxProps<T extends QueryTokensProps> extends Omit<
  AriaComboBoxProps<unknown>,
  'children'
> {
  applySeerSearchQuery: (item: T, runId?: number | string) => void;
  initialQuery: string;
  projectIds: number[];
  strategy: string;
  /**
   * Fallback mutation options to use if the polling endpoint fails.
   * If provided, the component will fall back to AskSeerComboBox on start failure.
   */
  fallbackMutationOptions?: AskSeerComboBoxProps<T>['askSeerMutationOptions'];
  /**
   * Optional key-value options to pass to the search agent start endpoint.
   * Used for strategy-specific context (e.g., metric name/type/unit for Metrics).
   */
  options?: Record<string, unknown>;
  /**
   * Transform the final response from the polling API to the expected format.
   * This allows customization of how the response is converted to query items.
   */
  transformResponse?: (response: T) => T[];
}

export function AskSeerPollingComboBox<T extends QueryTokensProps>({
  applySeerSearchQuery,
  initialQuery,
  projectIds,
  strategy,
  transformResponse,
  fallbackMutationOptions,
  options: extraOptions,
  ...props
}: AskSeerPollingComboBoxProps<T>) {
  const organization = useOrganization();
  const analyticsArea = useAnalyticsArea();
  const hasTrackedFetchErrorRef = useRef(false);
  const hasAskSeerUxRework = organization.features.includes('gen-ai-ask-seer-ux-rework');
  const [searchQuery, setSearchQuery] = useState(() =>
    formatQueryToNaturalLanguage(initialQuery)
  );

  const {
    submitQuery,
    isSessionPending,
    isPolling,
    isSessionError,
    finalResponse,
    unsupportedReason,
    currentStep,
    completedSteps,
    reset,
    startFailed,
    runId,
  } = useAskSeerPolling<T>({
    projectIds,
    strategy,
    options: extraOptions,
    onError: error => {
      addErrorMessage(t('Seer failed to process your search. Please try again.'));
      trackAnalytics('ai_query.error', {
        organization,
        area: analyticsArea,
        natural_language_query: searchQuery,
        is_fetch: false,
        status_code: error instanceof RequestError ? error.status : undefined,
      });
    },
  });

  const queries = useMemo(() => {
    if (!finalResponse) {
      return [];
    }
    return transformResponse ? transformResponse(finalResponse) : [finalResponse];
  }, [finalResponse, transformResponse]);

  // Track how often an error message is shown in ComboBox content. Guarded by a ref so
  // we only fire once per error occurrence (and reset once the error clears).
  useEffect(() => {
    if (isSessionError && !hasTrackedFetchErrorRef.current) {
      hasTrackedFetchErrorRef.current = true;
      trackAnalytics('ai_query.error', {
        organization,
        area: analyticsArea,
        natural_language_query: searchQuery,
        is_fetch: true,
      });
    } else if (!isSessionError) {
      hasTrackedFetchErrorRef.current = false;
    }
  }, [isSessionError, organization, analyticsArea, searchQuery]);

  if (startFailed && fallbackMutationOptions) {
    return (
      <AskSeerComboBox
        initialQuery={initialQuery}
        askSeerMutationOptions={fallbackMutationOptions}
        applySeerSearchQuery={applySeerSearchQuery}
      />
    );
  }

  const loadingContent = hasAskSeerUxRework ? (
    <AskSeerLoadingStatus completedSteps={completedSteps} currentStep={currentStep} />
  ) : (
    <Stack flex="1">
      <AskSeerSearchHeader title={t("I'm on it...")} loading />
      <AskSeerProgressBlocks completedSteps={completedSteps} currentStep={currentStep} />
    </Stack>
  );

  return (
    <BaseAskSeerComboBox
      {...props}
      applySeerSearchQuery={item => applySeerSearchQuery(item, runId ?? undefined)}
      searchQuery={searchQuery}
      onSearchQueryChange={setSearchQuery}
      queries={queries}
      unsupportedReason={unsupportedReason}
      submitQuery={submitQuery}
      isPending={isSessionPending || isPolling}
      isError={isSessionError}
      loadingContent={loadingContent}
      errorTitle={t('Seer failed to process your search. Please try again.')}
      emptyTitle={t("Describe what you're looking for")}
      onReset={reset}
    />
  );
}
