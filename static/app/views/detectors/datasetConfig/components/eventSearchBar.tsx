import {useEffect} from 'react';

import {loadOrganizationTags} from 'sentry/actionCreators/tags';
import useApi from 'sentry/utils/useApi';
import useOrganization from 'sentry/utils/useOrganization';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import type {DetectorSearchBarProps} from 'sentry/views/detectors/datasetConfig/base';
import {useCustomMeasurements} from 'sentry/views/detectors/datasetConfig/useCustomMeasurements';
import ResultsSearchQueryBuilder from 'sentry/views/discover/results/resultsSearchQueryBuilder';

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
  const {customMeasurements} = useCustomMeasurements();

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
    loadOrganizationTags(api, organization.slug, selection);
  }, [api, organization.slug, environment, projectIds]);

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
      customMeasurements={customMeasurements}
      dataset={dataset}
      includeTransactions={hasDatasetSelector(organization) ? false : true}
      searchSource="detectors"
    />
  );
}
