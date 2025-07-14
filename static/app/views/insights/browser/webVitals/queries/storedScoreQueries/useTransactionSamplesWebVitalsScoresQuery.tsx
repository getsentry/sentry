import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import type {WebVitals} from 'sentry/views/insights/browser/webVitals/types';
import {
  DEFAULT_INDEXED_SORT,
  SORTABLE_INDEXED_FIELDS,
} from 'sentry/views/insights/browser/webVitals/types';
import {mapWebVitalToOrderBy} from 'sentry/views/insights/browser/webVitals/utils/mapWebVitalToOrderBy';
import type {BrowserType} from 'sentry/views/insights/browser/webVitals/utils/queryParameterDecoders/browserType';
import {useWebVitalsSort} from 'sentry/views/insights/browser/webVitals/utils/useWebVitalsSort';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {SpanIndexedField, type SubregionCode} from 'sentry/views/insights/types';

type Props = {
  transaction: string;
  browserTypes?: BrowserType[];
  enabled?: boolean;
  limit?: number;
  orderBy?: WebVitals | null;
  query?: string;
  sortName?: string;
  subregions?: SubregionCode[];
  webVital?: WebVitals;
  withProfiles?: boolean;
};

export const useTransactionSamplesWebVitalsScoresQuery = ({
  orderBy,
  limit,
  transaction,
  query,
  enabled,
  withProfiles,
  sortName,
  webVital,
  browserTypes,
  subregions,
}: Props) => {
  const filteredSortableFields = SORTABLE_INDEXED_FIELDS;

  const sort = useWebVitalsSort({
    sortName,
    defaultSort: DEFAULT_INDEXED_SORT,
    sortableFields: filteredSortableFields as unknown as string[],
  });

  const mutableSearch = new MutableSearch([
    'transaction.op:pageload',
    'has:measurements.score.total',
  ]).addStringFilter(`transaction:"${transaction}"`);
  if (query) {
    mutableSearch.addStringMultiFilter(query);
  }
  if (browserTypes) {
    mutableSearch.addDisjunctionFilterValues(SpanIndexedField.BROWSER_NAME, browserTypes);
  }
  if (subregions) {
    mutableSearch.addDisjunctionFilterValues(
      SpanIndexedField.USER_GEO_SUBREGION,
      subregions
    );
  }

  const result = useSpans(
    {
      sorts: [sort],
      search: mutableSearch.formatString(),
      orderby:
        (mapWebVitalToOrderBy(orderBy) ?? withProfiles) ? '-profile.id' : undefined,
      limit: limit ?? 50,
      enabled,
      fields: [
        'id',
        'trace',
        'user.display',
        'transaction',
        'span.duration',
        'replayId',
        'timestamp',
        'profile.id',
        'project',
        'measurements.score.total',
        // TODO: use ratio field
        ...(webVital
          ? ([
              `measurements.score.${webVital}`,
              `measurements.score.weight.${webVital}`,
            ] as const)
          : []),
      ],
    },
    'api.performance.browser.web-vitals.transaction'
  );

  const finalData = result.data.map(row => ({
    ...row,
    'span.duration': row['span.duration'],
    ...(webVital
      ? {
          [`${webVital}Score`]: Math.round(
            (row[`measurements.score.${webVital}`] /
              row[`measurements.score.weight.${webVital}`]) *
              100
          ),
          [`${webVital}Weight`]: Math.round(
            row[`measurements.score.weight.${webVital}`] * 100
          ),
        }
      : {}),
  }));

  return {
    ...result,
    data: finalData,
  };
};
