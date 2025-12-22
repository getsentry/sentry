import {useMemo} from 'react';
import moment from 'moment-timezone';

import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {t, tct} from 'sentry/locale';
import {MutableSearch} from 'sentry/utils/tokenizeSearch';
import useOrganization from 'sentry/utils/useOrganization';
import usePageFilters from 'sentry/utils/usePageFilters';
import {Mode} from 'sentry/views/explore/contexts/pageParamsContext/mode';
import {type OurLogsResponseItem} from 'sentry/views/explore/logs/types';
import {getExploreUrl} from 'sentry/views/explore/utils';
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
  const organization = useOrganization();
  const {selection} = usePageFilters();

  const rep = tree.findRepresentativeTraceNode({logs});

  const op = rep?.event?.op ? String(rep.event.op) : '';
  const queryString = useMemo(() => {
    const search = new MutableSearch('');
    search.addFilterValue('is_transaction', 'true');

    if (op) {
      search.addFilterValue('span.op', op);
    }

    return search.formatString();
  }, [op]);

  if (!timestamp) {
    return null;
  }

  const now = moment();
  const isTraceTooYoung = moment(timestamp * 1000).isAfter(now.subtract(30, 'days'));

  if (isTraceTooYoung) {
    return null;
  }

  const projects =
    typeof rep?.event?.projectId === 'number' ? [rep.event?.projectId] : [];

  const exploreUrl = getExploreUrl({
    organization,
    mode: Mode.SAMPLES,
    query: queryString,
    table: 'trace',
    selection: {
      ...selection,
      projects,
      datetime: {
        start: null,
        end: null,
        utc: null,
        period: '24h',
      },
    },
  });

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
