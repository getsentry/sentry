import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {NewQuery} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {COLD_START_TYPE} from 'sentry/views/insights/mobile/appStarts/components/startTypeSelector';
import useCrossPlatformProject from 'sentry/views/insights/mobile/common/queries/useCrossPlatformProject';
import {TTID_CONTRIBUTING_SPAN_OPS} from 'sentry/views/insights/mobile/screenload/components/spanOpSelector';
import {useTableQuery} from 'sentry/views/insights/mobile/screenload/components/tables/screensTable';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const APP_START_SPANS = [
  ...TTID_CONTRIBUTING_SPAN_OPS,
  'app.start.cold',
  'app.start.warm',
  'contentprovider.load',
  'application.load',
  'activity.load',
  'process.load',
];

type Props = {
  primaryRelease?: string;
  secondaryRelease?: string;
  transaction?: string;
};

export function SpanOpSelector({transaction, primaryRelease, secondaryRelease}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const {selection} = usePageFilters();
  const {isProjectCrossPlatform, selectedPlatform} = useCrossPlatformProject();

  const value = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';
  const appStartType =
    decodeScalar(location.query[SpanMetricsField.APP_START_TYPE]) ?? COLD_START_TYPE;

  const searchQuery = new MutableSearch([
    // Exclude root level spans because they're comprised of nested operations
    '!span.description:"Cold Start"',
    '!span.description:"Warm Start"',
    // Exclude this span because we can get TTID contributing spans instead
    '!span.description:"Initial Frame Render"',
    'has:span.description',
    'transaction.op:ui.load',
    `transaction:${transaction}`,
    `has:ttid`,
    `span.op:[${APP_START_SPANS.join(',')}]`,
    `app_start_type:${appStartType}`,
  ]);

  if (isProjectCrossPlatform) {
    searchQuery.addFilterValue('os.name', selectedPlatform);
  }

  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const newQuery: NewQuery = {
    name: '',
    fields: [SpanMetricsField.SPAN_OP, 'count()'],
    query: queryStringPrimary,
    dataset: DiscoverDatasets.SPANS_METRICS,
    version: 2,
    projects: selection.projects,
  };

  const eventView = EventView.fromNewQueryWithLocation(newQuery, location);
  const {data} = useTableQuery({
    eventView,
    enabled: true,
    limit: 25,
    referrer: 'api.starfish.get-span-operations',
  });

  const options = [
    {value: '', label: t('All')},
    ...(data?.data ?? [])
      .filter(datum => Boolean(datum[SpanMetricsField.SPAN_OP]))
      .map(datum => {
        return {
          value: datum[SpanMetricsField.SPAN_OP]!,
          label: datum[SpanMetricsField.SPAN_OP],
        };
      }),
  ];

  return (
    <CompactSelect
      triggerProps={{prefix: t('Operation')}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        trackAnalytics('insight.app_start.spans.filter_by_operation', {
          organization,
          filter: newValue.value as unknown as string,
        });

        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanMetricsField.SPAN_OP]: newValue.value,
            [MobileCursors.SPANS_TABLE]: undefined,
          },
        });
      }}
    />
  );
}
