import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {CompactSelect} from 'sentry/components/core/compactSelect';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {decodeScalar} from 'sentry/utils/queryString';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useSpans} from 'sentry/views/insights/common/queries/useDiscover';
import {appendReleaseFilters} from 'sentry/views/insights/common/utils/releaseComparison';
import {MobileCursors} from 'sentry/views/insights/mobile/screenload/constants';
import {SpanFields} from 'sentry/views/insights/types';

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
  transaction?: string;
};

export function SpanOpSelector({transaction, primaryRelease}: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const value = decodeScalar(location.query[SpanFields.SPAN_OP]) ?? '';

  const searchQuery = new MutableSearch([
    'transaction.op:[ui.load,navigation]',
    `transaction:${transaction}`,
    `span.op:[${TTID_CONTRIBUTING_SPAN_OPS.join(',')}]`,
    'has:span.description',
  ]);
  const queryStringPrimary = appendReleaseFilters(searchQuery, primaryRelease);

  const {data} = useSpans(
    {
      limit: 25,
      search: queryStringPrimary,
      fields: [SpanFields.SPAN_OP, 'count()'],
    },
    'api.insights.get-span-operations'
  );

  const options = [
    {value: '', label: t('All')},
    ...data
      .filter(datum => Boolean(datum[SpanFields.SPAN_OP]))
      .map(datum => {
        return {
          value: datum[SpanFields.SPAN_OP],
          label: datum[SpanFields.SPAN_OP],
        };
      }),
  ];

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Operation')} size="md" />
      )}
      value={value}
      options={options ?? []}
      onChange={newValue => {
        trackAnalytics('insight.screen_load.spans.filter_by_operation', {
          organization,
          filter: newValue.value,
        });

        navigate({
          ...location,
          query: {
            ...location.query,
            [SpanFields.SPAN_OP]: newValue.value,
            [MobileCursors.SPANS_TABLE]: undefined,
          },
        });
      }}
    />
  );
}
