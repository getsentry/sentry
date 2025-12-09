import {useMemo} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import type {OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {getRepresentativeTraceEvent} from 'sentry/views/performance/newTraceDetails/traceApi/utils';
import {getTitle} from 'sentry/views/performance/newTraceDetails/traceHeader/title';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

interface PartialTraceDataWarningProps {
  logs: OurLogsResponseItem[] | undefined;
  timestamp: number | undefined;
  tree: TraceTree;
}

export function PartialTraceDataWarning({
  logs,
  timestamp,
  tree,
}: PartialTraceDataWarningProps) {
  const rep = getRepresentativeTraceEvent(tree, logs);
  const traceTitle = getTitle(rep);

  const queryString = useMemo(() => {
    const search = new MutableSearch('');
    search.addFilterValue('is_transaction', 'true');
    search.addFilterValue('span.op', traceTitle?.title ?? '');
    return search.formatString();
  }, [traceTitle?.title]);

  if (!timestamp) {
    return null;
  }

  const now = moment();
  const isTraceTooYoung = moment(timestamp * 1000).isAfter(now.subtract(30, 'days'));

  if (isTraceTooYoung) {
    return null;
  }

  const exploreUrl = `/explore/traces/?mode=${Mode.SAMPLES}&table=trace&statsPeriod=24h&query=${queryString}`;

  return (
    <Alert
      type="warning"
      trailingItems={
        <Link to={exploreUrl}>{t('Search similar traces in the past 24 hours')}</Link>
      }
    >
      <Text as="p">
        {tct(
          '[dataCategory] Trace may be missing spans since the age of the trace is older than 30 days',
          {
            dataCategory: <Text bold>{t('Partial Trace Data:')}</Text>,
          }
        )}
      </Text>
    </Alert>
  );
}
