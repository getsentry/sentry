import {useMemo} from 'react';

import {FeatureBadge} from 'sentry/components/core/badge/featureBadge';
import {t} from 'sentry/locale';
import type {SelectValue} from 'sentry/types/core';
import type {MetricDetector} from 'sentry/types/workflowEngine/detectors';
import useOrganization from 'sentry/utils/useOrganization';
import {Dataset} from 'sentry/views/alerts/rules/metric/types';
import {hasLogAlerts} from 'sentry/views/alerts/wizard/utils';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {DetectorDataset} from 'sentry/views/detectors/datasetConfig/types';
import {deprecateTransactionAlerts} from 'sentry/views/insights/common/utils/hasEAPAlerts';

/**
 * Returns dataset choices for the metric detector form, handling transactions deprecation
 * and allowing existing transactions-based detectors to continue to display.
 */
export function useDatasetChoices(): Array<SelectValue<DetectorDataset>> {
  const organization = useOrganization();
  const {detector} = useDetectorFormContext();
  const savedDataset = (detector as MetricDetector | undefined)?.dataSources[0]?.queryObj
    ?.snubaQuery?.dataset;
  const isExistingTransactionsDetector =
    detector &&
    savedDataset &&
    [Dataset.TRANSACTIONS, Dataset.GENERIC_METRICS].includes(savedDataset);
  const shouldHideTransactionsDataset =
    !isExistingTransactionsDetector && deprecateTransactionAlerts(organization);

  return useMemo(() => {
    const datasetChoices: Array<SelectValue<DetectorDataset>> = [
      {
        value: DetectorDataset.ERRORS,
        label: t('Errors'),
      },
      ...(shouldHideTransactionsDataset
        ? []
        : [
            {
              value: DetectorDataset.TRANSACTIONS,
              label: t('Transactions'),
            },
          ]),
      ...(organization.features.includes('visibility-explore-view')
        ? [{value: DetectorDataset.SPANS, label: t('Spans')}]
        : []),
      ...(hasLogAlerts(organization)
        ? [
            {
              value: DetectorDataset.LOGS,
              label: t('Logs'),
              trailingItems: <FeatureBadge type="new" />,
            },
          ]
        : []),
      {value: DetectorDataset.RELEASES, label: t('Releases')},
    ];

    return datasetChoices;
  }, [organization, shouldHideTransactionsDataset]);
}
