import type {Aggregation} from 'sentry/utils/discover/fields';
import {AGGREGATIONS} from 'sentry/utils/discover/fields';
import type {AlertType} from 'sentry/views/alerts/wizard/options';
import {
  hideParameterSelectorSet,
  hidePrimarySelectorSet,
} from 'sentry/views/alerts/wizard/options';

import type {OptionConfig} from './constants';
import {
  errorFieldConfig,
  getWizardAlertFieldConfig,
  transactionFieldConfig,
} from './constants';
import {Dataset} from './types';

export const getFieldOptionConfig = ({
  dataset,
  alertType,
}: {
  dataset: Dataset;
  alertType?: AlertType;
}) => {
  let config: OptionConfig;
  let hidePrimarySelector = false;
  let hideParameterSelector = false;
  if (alertType) {
    config = getWizardAlertFieldConfig(alertType, dataset);
    hidePrimarySelector = hidePrimarySelectorSet.has(alertType);
    hideParameterSelector = hideParameterSelectorSet.has(alertType);
  } else {
    config = dataset === Dataset.ERRORS ? errorFieldConfig : transactionFieldConfig;
  }
  const aggregations = Object.fromEntries<Aggregation>(
    config.aggregations.map(key => {
      // TODO(scttcper): Temporary hack for default value while we handle the translation of user
      if (key === 'count_unique') {
        const agg = AGGREGATIONS[key] as Aggregation;
        agg.getFieldOverrides = () => {
          return {defaultValue: 'tags[sentry:user]'};
        };
        return [key, agg];
      }

      // When using apdex with the transactions dataset, it uses the metrics which does not accept a parameter.
      // Attempting to save with `apdex(300)` will fail with the message: "Cannot query apdex with a threshold parameter on the metrics dataset"
      if (
        (dataset === Dataset.TRANSACTIONS || dataset === Dataset.GENERIC_METRICS) &&
        key === 'apdex'
      ) {
        const base = AGGREGATIONS[key] as Aggregation;
        const agg: Aggregation = {...base, parameters: []};
        return [key, agg];
      }

      // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
      return [key, AGGREGATIONS[key]];
    })
  );

  const fieldKeys = config.fields.map(key => {
    // XXX(epurkhiser): Temporary hack while we handle the translation of user ->
    // tags[sentry:user].
    if (key === 'user') {
      return 'tags[sentry:user]';
    }

    return key;
  });

  const {measurementKeys, spanOperationBreakdownKeys} = config;

  return {
    fieldOptionsConfig: {
      aggregations,
      fieldKeys,
      measurementKeys,
      spanOperationBreakdownKeys,
    },
    hidePrimarySelector,
    hideParameterSelector,
  };
};
