import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  tag: string;
  transaction: string;
  limit?: number;
  orderBy?: string;
};

export const useSlowestTagValuesQuery = ({tag, transaction, limit}: Props) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        tag,
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        `transaction.op:pageload has:${tag}` +
        (transaction ? ` transaction:"${transaction}"` : ''),
      version: 2,
      dataset: DiscoverDatasets.METRICS,
      // We don't have performance scores yet, so sort by lcp for now as an estimate
      orderby: '-p75_measurements_lcp',
    },
    pageFilters.selection
  );

  return useDiscoverQuery({
    eventView: projectEventView,
    limit: limit ?? 50,
    location,
    orgSlug: organization.slug,
    options: {
      enabled: pageFilters.isReady,
      refetchOnWindowFocus: false,
    },
  });
};
