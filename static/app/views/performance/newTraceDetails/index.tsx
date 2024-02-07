import {useMemo, useState} from 'react';

import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {t} from 'sentry/locale';
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import {Trace} from './trace';

const DOCUMENT_TITLE = [t('Trace Details'), t('Performance')].join(' — ');

export function TraceView() {
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = params.traceSlug?.trim() ?? '';

  const dateSelection = useMemo(() => {
    const queryParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(queryParams.start);
    const end = decodeScalar(queryParams.end);
    const statsPeriod = decodeScalar(queryParams.statsPeriod);

    return {start, end, statsPeriod};
  }, [location.query]);

  // @TODO pass this to children
  // const _traceEventView = useMemo(() => {
  //   const {start, end, statsPeriod} = dateSelection;

  //   return EventView.fromSavedQuery({
  //     id: undefined,
  //     name: `Events with Trace ID ${traceSlug}`,
  //     fields: ['title', 'event.type', 'project', 'timestamp'],
  //     orderby: '-timestamp',
  //     query: `trace:${traceSlug}`,
  //     projects: [ALL_ACCESS_PROJECTS],
  //     version: 2,
  //     start,
  //     end,
  //     range: statsPeriod,
  //   });
  // }, []);

  const [_limit, _setLimit] = useState<number>();
  // const _handleLimithange = useCallback((newLimit: number) => {
  //   setLimit(newLimit);
  // }, []);

  return (
    <SentryDocumentTitle title={DOCUMENT_TITLE} orgSlug={organization.slug}>
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <TraceFullDetailedQuery
            location={location}
            orgSlug={organization.slug}
            traceId={traceSlug}
            start={dateSelection.start}
            end={dateSelection.end}
            statsPeriod={dateSelection.statsPeriod}
          >
            {trace => <Trace trace={trace?.traces} trace_id={traceSlug} />}
          </TraceFullDetailedQuery>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}
