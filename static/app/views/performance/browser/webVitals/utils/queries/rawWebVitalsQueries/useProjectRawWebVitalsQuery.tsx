import {Tag} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  dataset?: DiscoverDatasets;
  tag?: Tag;
  transaction?: string;
};

export const useProjectRawWebVitalsQuery = ({transaction, tag, dataset}: Props = {}) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'p75(measurements.lcp)',
        'p75(measurements.fcp)',
        'p75(measurements.cls)',
        'p75(measurements.ttfb)',
        'p75(measurements.fid)',
        'p75(transaction.duration)',
        'count_web_vitals(measurements.lcp, any)',
        'count_web_vitals(measurements.fcp, any)',
        'count_web_vitals(measurements.cls, any)',
        'count_web_vitals(measurements.fid, any)',
        'count_web_vitals(measurements.ttfb, any)',
        'count()',
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:pageload',
        ...(transaction ? [`transaction:"${transaction}"`] : []),
        ...(tag ? [`{tag.key}:"${tag.name}"`] : []),
      ].join(' '),
      version: 2,
      dataset: dataset ?? DiscoverDatasets.METRICS,
    },
    pageFilters.selection
  );

  return useDiscoverQuery({
    eventView: projectEventView,
    limit: 50,
    location,
    orgSlug: organization.slug,
    cursor: '',
    options: {
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project',
  });
};
