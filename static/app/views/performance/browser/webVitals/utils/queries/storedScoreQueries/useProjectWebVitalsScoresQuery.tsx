import type {Tag} from 'sentry/types';
import {useDiscoverQuery} from 'sentry/utils/discover/discoverQuery';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import type {WebVitals} from 'sentry/views/performance/browser/webVitals/utils/types';
import {useReplaceFidWithInpSetting} from 'sentry/views/performance/browser/webVitals/utils/useReplaceFidWithInpSetting';

type Props = {
  dataset?: DiscoverDatasets;
  enabled?: boolean;
  tag?: Tag;
  transaction?: string;
  weightWebVital?: WebVitals | 'total';
};

export const useProjectWebVitalsScoresQuery = ({
  transaction,
  tag,
  dataset,
  enabled = true,
  weightWebVital = 'total',
}: Props = {}) => {
  const organization = useOrganization();
  const pageFilters = usePageFilters();
  const location = useLocation();
  const shouldReplaceFidWithInp = useReplaceFidWithInpSetting();

  const projectEventView = EventView.fromNewQueryWithPageFilters(
    {
      fields: [
        'performance_score(measurements.score.lcp)',
        'performance_score(measurements.score.fcp)',
        'performance_score(measurements.score.cls)',
        'performance_score(measurements.score.fid)',
        'performance_score(measurements.score.ttfb)',
        'avg(measurements.score.total)',
        'avg(measurements.score.weight.lcp)',
        'avg(measurements.score.weight.fcp)',
        'avg(measurements.score.weight.cls)',
        'avg(measurements.score.weight.fid)',
        'avg(measurements.score.weight.ttfb)',
        'count()',
        'count_scores(measurements.score.total)',
        'count_scores(measurements.score.lcp)',
        'count_scores(measurements.score.fcp)',
        'count_scores(measurements.score.cls)',
        'count_scores(measurements.score.ttfb)',
        'count_scores(measurements.score.fid)',
        ...(weightWebVital !== 'total'
          ? [
              // TODO: Remove this once we can query for INP.
              `sum(measurements.score.weight.${
                shouldReplaceFidWithInp && weightWebVital === 'inp'
                  ? 'fid'
                  : weightWebVital
              })`,
            ]
          : []),
      ],
      name: 'Web Vitals',
      query: [
        'transaction.op:pageload',
        ...(transaction ? [`transaction:"${transaction}"`] : []),
        ...(tag ? [`${tag.key}:"${tag.name}"`] : []),
      ].join(' '),
      version: 2,
      dataset: dataset ?? DiscoverDatasets.METRICS,
    },
    pageFilters.selection
  );

  const result = useDiscoverQuery({
    eventView: projectEventView,
    limit: 50,
    location,
    orgSlug: organization.slug,
    cursor: '',
    options: {
      enabled,
      refetchOnWindowFocus: false,
    },
    skipAbort: true,
    referrer: 'api.performance.browser.web-vitals.project-scores',
  });

  if (
    result.status === 'success' &&
    result.data?.data?.[0]?.['avg(measurements.score.weight.fid)'] !== undefined &&
    result.data?.data?.[0]?.['count_scores(measurements.score.fid)'] !== undefined &&
    result.data?.data?.[0]?.['performance_score(measurements.score.fid)'] !== undefined
  ) {
    // Fake INP data with FID data
    // TODO(edwardgou): Remove this once INP is queryable in discover
    result.data.data[0]['avg(measurements.score.weight.inp)'] =
      result.data.data[0]['avg(measurements.score.weight.fid)'];
    result.data.data[0]['count_scores(measurements.score.inp)'] =
      result.data.data[0]['count_scores(measurements.score.fid)'];
    result.data.data[0]['performance_score(measurements.score.inp)'] =
      result.data.data[0]['performance_score(measurements.score.fid)'];
  }
  return result;
};
