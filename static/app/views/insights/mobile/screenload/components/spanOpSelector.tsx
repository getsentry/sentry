import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpanMetrics} from 'sentry/views/insights/common/queries/useDiscover';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {SpanMetricsField} from 'sentry/views/insights/types';

export const TTID_CONTRIBUTING_SPAN_OPS = [
  'file.read',
  'file.write',
  'ui.load',
  'navigation',
  'http.client',
  'db',
  'db.sql.room',
  'db.sql.query',
  'db.sql.transaction',
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
  const value = decodeScalar(location.query[SpanMetricsField.SPAN_OP]) ?? '';

  const searchQuery = new MutableSearch([
    'transaction.op:[ui.load,navigation]',
    `transaction:${transaction}`,
    `span.op:[${TTID_CONTRIBUTING_SPAN_OPS.join(',')}]`,
    'has:span.description',
  ]);
  const queryStringPrimary = appendReleaseFilters(
    searchQuery,
    primaryRelease,
    secondaryRelease
  );

  const {data} = useSpanMetrics(
    {
      limit: 25,
      search: queryStringPrimary,
      fields: [SpanMetricsField.SPAN_OP, 'count()'],
    },
    'api.starfish.get-span-operations'
  );

  const options = [
    {value: '', label: t('All')},
    ...data
      .filter(datum => Boolean(datum[SpanMetricsField.SPAN_OP]))
      .map(datum => {
        return {
          value: datum[SpanMetricsField.SPAN_OP],
          label: datum[SpanMetricsField.SPAN_OP],
        };
      }),
  ];

  return (
    <StyledCompactSelect
      triggerProps={{prefix: t('Operation'), size: 'xs'}}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        trackAnalytics('insight.screen_load.spans.filter_by_operation', {
          organization,
          filter: newValue.value as string,
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

const StyledCompactSelect = styled(CompactSelect)`
  margin-bottom: ${space(1)};
`;
