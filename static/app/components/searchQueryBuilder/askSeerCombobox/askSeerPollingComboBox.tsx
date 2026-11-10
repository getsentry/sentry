import {useEffect, useMemo, useRef, useState} from 'react';

import {toast} from '@sentry/scraps/toast';

import {useAnalyticsArea} from 'sentry/components/analyticsArea';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getConversationsUrlForExternalUse} from 'sentry/views/explore/conversations/utils/urlParams';

import {AskSeerComboBox, type AskSeerComboBoxProps} from './askSeerComboBox';
import {AskSeerLoadingStatus} from './askSeerLoadingStatus';
import {BaseAskSeerComboBox} from './baseAskSeerComboBox';
import type {AskSeerStrategy, QueryTokensProps} from './types';
import {useAskSeerPolling} from './useAskSeerPolling';
import {formatQueryToNaturalLanguage, getAskSeerErrorMessage} from './utils';

interface AskSeerPollingComboBoxProps<T extends QueryTokensProps> {
  applySeerSearchQuery: (item: T, runId?: number | string) => void;
  initialQuery: string;
  projectIds: number[];
  strategy: AskSeerStrategy;
  className?: string;
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
    requestError,
    isCompleted,
    runId,
  } = useAskSeerPolling<T>({
    projectIds,
    strategy,
    referrer: 'search_bar',
    options: extraOptions,
    onError: error => {
      toast.error(
        getAskSeerErrorMessage(
          error,
          t('Seer failed to process your search. Please try again.')
        )
      );
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

  // The fallback endpoint runs the same access checks, so after a 403 it would
  // only fail again with a vaguer message.
  const isAccessDenied =
    requestError instanceof RequestError && requestError.status === 403;

  if (startFailed && fallbackMutationOptions && !isAccessDenied) {
    return (
      <AskSeerComboBox
        {...props}
        initialQuery={initialQuery}
        askSeerMutationOptions={fallbackMutationOptions}
        applySeerSearchQuery={applySeerSearchQuery}
      />
    );
  }

  const loadingContent = (
    <AskSeerLoadingStatus completedSteps={completedSteps} currentStep={currentStep} />
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
      isError={isSessionError || startFailed}
      hasResponse={isCompleted}
      loadingContent={loadingContent}
      errorTitle={
        unsupportedReason ||
        getAskSeerErrorMessage(
          requestError,
          t('Seer failed to process your search. Please try again.')
        )
      }
      emptyTitle={t("Describe what you're looking for")}
      additionalFeedbackTags={
        runId
          ? {
              conversation_url: getConversationsUrlForExternalUse('sentry', runId),
            }
          : undefined
      }
      onReset={reset}
    />
  );
}
