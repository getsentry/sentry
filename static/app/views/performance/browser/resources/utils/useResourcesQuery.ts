import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {useResourceModuleFilters} from 'sentry/views/performance/browser/resources/utils/useResourceFilters';
import {ValidSort} from 'sentry/views/performance/browser/resources/utils/useResourceSort';

export const useResourcesQuery = ({sort}: {sort: ValidSort}) => {
  const pageFilters = usePageFilters();
  const location = useLocation();
  const resourceFilters = useResourceModuleFilters();
  const {slug: orgSlug} = useOrganization();
  const queryConditions = [
    `span.op:[${resourceFilters.type || 'resource.script, resource.img'}]`,
  ];

  // TODO - we should be using metrics data here
  const eventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: ['span.description', 'span.op', 'count()', 'avg(span.self_time)', 'spm()'],
      name: 'Resource module - resource table',
      query: queryConditions.join(' '),
      orderby: '-count',
      version: 2,
      dataset: DiscoverDatasets.SPANS_METRICS,
    },
    pageFilters.selection
  );

  if (sort) {
    eventView.sorts = [sort];
  }

  const result = useDiscoverQuery({eventView, limit: 100, location, orgSlug});

  const data = result?.data?.data.map(row => ({
    'span.op': row['span.op'].toString() as 'resource.script' | 'resource.img',
    'span.description': row['span.description'].toString(),
    'avg(span.self_time)': row['avg(span.self_time)'] as number,
    'count()': row['count()'] as number,
    'spm()': row['spm()'] as number,
  }));

  return {...result, data: data || []};
};
