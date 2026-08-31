import {useCallback, useEffect, useState} from 'react';

import {useModal} from '@sentry/scraps/modal';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import {defined} from 'sentry/utils/defined';
import type {EventView} from 'sentry/utils/discover/eventView';
import {getRequestErrorUserMessage} from 'sentry/utils/requestError/getRequestErrorUserMessage';
import {RequestError} from 'sentry/utils/requestError/requestError';
import {useApi} from 'sentry/utils/useApi';
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
  /** True while the current threshold is being read; the trigger should be disabled. */
  isLoading: boolean;
  openThresholdModal: () => void;
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
  const api = useApi();
  const {openModal} = useModal();
  const {projects} = useProjects();

  const [isLoading, setIsLoading] = useState(false);
  const [transactionThreshold, setTransactionThreshold] = useState<number>();
  const [transactionThresholdMetric, setTransactionThresholdMetric] =
    useState<TransactionThresholdMetric>();

  const project = useEventViewProject(projects, eventView);

  useEffect(() => {
    if (!defined(project)) {
      return;
    }
    const transactionThresholdUrl = `/organizations/${organization.slug}/project-transaction-threshold-override/`;

    setIsLoading(true);

    // A transaction-level override is preferred; when there is none the project
    // default applies, so the 404 is expected rather than an error.
    api
      .requestPromise(transactionThresholdUrl, {
        method: 'GET',
        includeAllArgs: true,
        query: {
          project: project.id,
          transaction: transactionName,
        },
      })
      .then(([data]) => {
        setIsLoading(false);
        setTransactionThreshold(data.threshold);
        setTransactionThresholdMetric(data.metric);
      })
      .catch(() => {
        const projectThresholdUrl = `/projects/${organization.slug}/${project.slug}/transaction-threshold/configure/`;
        api
          .requestPromise(projectThresholdUrl, {
            method: 'GET',
            includeAllArgs: true,
            query: {
              project: project.id,
            },
          })
          .then(([data]) => {
            setIsLoading(false);
            setTransactionThreshold(data.threshold);
            setTransactionThresholdMetric(data.metric);
          })
          .catch(err => {
            setIsLoading(false);
            const thresholdMessage =
              err instanceof RequestError ? err.responseJSON?.threshold : undefined;
            const message =
              typeof thresholdMessage === 'string'
                ? thresholdMessage
                : getRequestErrorUserMessage(
                    err,
                    t('Failed to load transaction threshold settings.')
                  );
            addErrorMessage(message);
          });
      });
  }, [api, project, organization.slug, transactionName]);

  const openThresholdModal = useCallback(() => {
    openModal(
      modalProps => (
        <TransactionThresholdModal
          {...modalProps}
          organization={organization}
          transactionName={transactionName}
          eventView={eventView}
          transactionThreshold={transactionThreshold}
          transactionThresholdMetric={transactionThresholdMetric}
          onApply={(threshold, metric) => {
            setTransactionThreshold(threshold);
            setTransactionThresholdMetric(metric);
            onChangeThreshold?.(threshold, metric);
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
    transactionThreshold,
    transactionThresholdMetric,
    onChangeThreshold,
  ]);

  return {isLoading, openThresholdModal};
}
