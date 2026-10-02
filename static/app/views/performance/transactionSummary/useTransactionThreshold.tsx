import {useCallback, useEffect} from 'react';
import {skipToken, useQuery, useQueryClient} from '@tanstack/react-query';

import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {apiOptions} from 'sentry/utils/api/apiOptions';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useProjects} from 'sentry/utils/useProjects';

import type {TransactionThresholdMetric} from './transactionThresholdModal';
import TransactionThresholdModal, {modalCss} from './transactionThresholdModal';
import {useEventViewProject} from './useEventViewProject';

interface UseTransactionThresholdProps {
  eventView: EventView;
  organization: Organization;
  transactionName: string;
  onChangeThreshold?: (threshold: number, metric: TransactionThresholdMetric) => void;
}

export interface TransactionThreshold {
  /**
   * True while the threshold cannot be read or written — either the project has
   * not resolved yet or a request is in flight. The trigger should be disabled.
   */
  isLoading: boolean;
  openThresholdModal: () => void;
}

interface ThresholdResponse {
  metric: TransactionThresholdMetric;
  threshold: number;
}

/**
 * Loads the response time threshold that applies to a transaction and exposes a
 * modal for editing it. Shared by every entry point that offers the control, so
 * the two-step lookup below lives in one place.
 */
export function useTransactionThreshold({
  eventView,
  organization,
  transactionName,
  onChangeThreshold,
}: UseTransactionThresholdProps): TransactionThreshold {
  const {openModal} = useModal();
  const {projects} = useProjects();
  const queryClient = useQueryClient();

  const project = useEventViewProject(projects, eventView);

  // A transaction-level override wins when one exists. Most transactions do not
  // have one, so the 404 is the expected path rather than a failure — never
  // retry, just fall through to the project default.
  const overrideOptions = apiOptions.as<ThresholdResponse>()(
    '/organizations/$organizationIdOrSlug/project-transaction-threshold-override/',
    {
      path: project ? {organizationIdOrSlug: organization.slug} : skipToken,
      query: project ? {project: project.id, transaction: transactionName} : undefined,
      staleTime: 0,
    }
  );
  const overrideQuery = useQuery({...overrideOptions, retry: false});

  const projectOptions = apiOptions.as<ThresholdResponse>()(
    '/projects/$organizationIdOrSlug/$projectIdOrSlug/transaction-threshold/configure/',
    {
      path: project
        ? {organizationIdOrSlug: organization.slug, projectIdOrSlug: project.slug}
        : skipToken,
      query: project ? {project: project.id} : undefined,
      staleTime: 0,
    }
  );
  const projectThresholdQuery = useQuery({
    ...projectOptions,
    // Gate the fetch rather than the path, so the cache key stays addressable
    // for invalidation instead of collapsing to the unresolved URL template.
    enabled: projectOptions.enabled && overrideQuery.isError,
    retry: false,
  });

  // Failing to read the project default is a genuine error, unlike the missing
  // override above.
  const projectThresholdError = projectThresholdQuery.error;
  useEffect(() => {
    if (!projectThresholdError) {
      return;
    }
    const thresholdMessage =
      projectThresholdError instanceof RequestError
        ? projectThresholdError.responseJSON?.threshold
        : undefined;
    addErrorMessage(
      typeof thresholdMessage === 'string'
        ? thresholdMessage
        : getRequestErrorUserMessage(
            projectThresholdError,
            t('Failed to load transaction threshold settings.')
          )
    );
  }, [projectThresholdError]);

  // React Query keeps the last successful `data` when a refetch fails, so a
  // deleted override would otherwise linger after `Reset All`. Only trust the
  // override while its query is not in an error state.
  const threshold = overrideQuery.isError
    ? projectThresholdQuery.data
    : overrideQuery.data;

  // Both queries are disabled until the project resolves, and a disabled query
  // reports `isLoading: false` — so the project has to be checked separately or
  // the trigger opens a modal that cannot write anything.
  //
  // Staying loading across the handover to the project default also keeps the
  // trigger from flickering enabled for a render between the two requests.
  const isLoading =
    !project ||
    overrideQuery.isLoading ||
    (overrideQuery.isError && projectThresholdQuery.isPending);

  const overrideUrl = overrideOptions.queryKey[0];
  const projectThresholdUrl = projectOptions.queryKey[0];

  const openThresholdModal = useCallback(() => {
    openModal(
      modalProps => (
        <TransactionThresholdModal
          {...modalProps}
          organization={organization}
          transactionName={transactionName}
          eventView={eventView}
          transactionThreshold={threshold?.threshold}
          transactionThresholdMetric={threshold?.metric}
          onApply={(newThreshold, metric) => {
            // The modal writes the threshold itself, so refetch rather than
            // patching the cache by hand.
            queryClient.invalidateQueries({queryKey: [overrideUrl]});
            queryClient.invalidateQueries({queryKey: [projectThresholdUrl]});
            onChangeThreshold?.(newThreshold, metric);
          }}
        />
      ),
      {modalCss, closeEvents: 'escape-key'}
    );
  }, [
    openModal,
    organization,
    transactionName,
    eventView,
    threshold,
    queryClient,
    overrideUrl,
    projectThresholdUrl,
    onChangeThreshold,
  ]);

  return {isLoading, openThresholdModal};
}
