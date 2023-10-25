function ImageResourceView() {
  useResourcesQuery();
  return <div>Add a sample table here, with some filters</div>;
}

import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {SpanMetricsField} from 'sentry/views/starfish/types';

const {SPAN_DESCRIPTION, SPAN_OP, HTTP_RESPONSE_CONTENT_LENGTH} = SpanMetricsField;

export const useResourcesQuery = () => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [`${SPAN_OP}:resource.img`, 'has:http.response_content_length'];

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [SPAN_DESCRIPTION, SPAN_OP, HTTP_RESPONSE_CONTENT_LENGTH],
      name: 'Resource module - resource table',
      query: queryConditions.join(' '),
      version: 2,
      dataset: DiscoverDatasets.SPANS_INDEXED,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({eventView, limit: 100, location, orgSlug});

  // console.log(result);

  return {...result};
};

export default ImageResourceView;
