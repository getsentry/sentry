import {Tag} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';

type Props = {
  dataset?: DiscoverDatasets;
  enabled?: boolean;
  tag?: Tag;
  transaction?: string;
};

export const useProjectWebVitalsScoresQuery = ({
  transaction,
  tag,
  dataset,
  enabled = true,
}: Props = {}) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'avg(measurements.score.lcp)',
        'avg(measurements.score.fcp)',
        'avg(measurements.score.cls)',
        'avg(measurements.score.fid)',
        'avg(measurements.score.ttfb)',
        'avg(measurements.score.weight.lcp)',
        'avg(measurements.score.weight.fcp)',
        'avg(measurements.score.weight.cls)',
        'avg(measurements.score.weight.fid)',
        'avg(measurements.score.weight.ttfb)',
        'avg(measurements.score.total)',
        'count()',
      ],
      name: 'Web Vitals',
      query:
        'transaction.op:pageload' +
        (transaction ? ` transaction:"${transaction}"` : '') +
        (tag ? ` ${tag.key}:"${tag.name}"` : ''),
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
      enabled: pageFilters.isReady && enabled,
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project-scores',
  });
};
