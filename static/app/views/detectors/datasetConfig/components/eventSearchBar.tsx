import {useEffect} from 'react';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import {useApi} from 'sentry/utils/useApi';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useGlobalAlerts} from 'sentry/views/app/globalAlerts';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {ResultsSearchQueryBuilder} from 'sentry/views/discover/results/resultsSearchQueryBuilder';

export function EventsSearchBar({
  initialQuery,
  projectIds,
  onSearch,
  onClose,
  dataset,
  environment,
}: DetectorSearchBarProps) {
  const api = useApi();
  const organization = useOrganization();
  const {addAlert} = useGlobalAlerts();

  useEffect(() => {
    const selection = {
      projects: projectIds,
      datetime: {
        start: null,
        end: null,
        period: '7d',
        utc: null,
      },
      environments: [environment],
    };
    loadOrganizationTags(api, organization.slug, selection, addAlert);
  }, [api, organization.slug, environment, projectIds, addAlert]);

  return (
    <ResultsSearchQueryBuilder
      projectIds={projectIds}
      query={initialQuery}
      // TODO: do we need fields?
      fields={[]}
      onChange={(query, state) => {
        onClose?.(query, {validSearch: state.queryIsValid});
      }}
      onSearch={onSearch}
      customMeasurements={{}}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
      searchSource="detectors"
    />
  );
}
