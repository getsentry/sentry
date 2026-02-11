import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {DEFAULT_SAMPLING_MODE} from 'sentry/views/insights/common/queries/useDiscover';

export const EAP_QUERY_PARAMS = {
  dataset: DiscoverDatasets.SPANS,
  sampling: DEFAULT_SAMPLING_MODE,
};
