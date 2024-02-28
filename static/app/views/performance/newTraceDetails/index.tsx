import {Fragment, useMemo} from 'react';
import type {Location} from 'history';

import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {t} from 'sentry/locale';
import type {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import TraceMetaQuery, {
  type TraceMetaQueryChildrenProps,
} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {useTrace} from 'sentry/views/performance/newTraceDetails/useTrace';

import Breadcrumb from '../breadcrumb';

import Trace from './trace';
import {TraceFooter} from './traceFooter';
import TraceHeader from './traceHeader';
import {TraceTree} from './traceTree';
import TraceWarnings from './traceWarnings';

const DOCUMENT_TITLE = [t('Trace Details'), t('Performance')].join(' — ');

export function TraceView() {
  const location = useLocation();
  const organization = useOrganization();
  const params = useParams<{traceSlug?: string}>();

  const traceSlug = params.traceSlug?.trim() ?? '';

  const queryParams = useMemo(() => {
    const normalizedParams = normalizeDateTimeParams(location.query, {
      allowAbsolutePageDatetime: true,
    });
    const start = decodeScalar(normalizedParams.start);
    const end = decodeScalar(normalizedParams.end);
    const statsPeriod = decodeScalar(normalizedParams.statsPeriod);

    return {start, end, statsPeriod, useSpans: 1};
  }, [location.query]);

  const traceEventView = useMemo(() => {
    const {start, end, statsPeriod} = queryParams;

    return EventView.fromSavedQuery({
      id: undefined,
      name: `Events with Trace ID ${traceSlug}`,
      fields: ['title', 'event.type', 'project', 'timestamp'],
      orderby: '-timestamp',
      query: `trace:${traceSlug}`,
      projects: [ALL_ACCESS_PROJECTS],
      version: 2,
      start,
      end,
      range: statsPeriod,
    });
  }, [queryParams, traceSlug]);

  const trace = useTrace();

  return (
    <SentryDocumentTitle title={DOCUMENT_TITLE} orgSlug={organization.slug}>
      <Layout.Page>
        <NoProjectMessage organization={organization}>
          <TraceMetaQuery
            location={location}
            orgSlug={organization.slug}
            traceId={traceSlug}
            start={queryParams.start}
            end={queryParams.end}
            statsPeriod={queryParams.statsPeriod}
          >
            {metaResults => (
              <TraceViewContent
                status={trace.status}
                trace={trace.data}
                traceSlug={traceSlug}
                organization={organization}
                location={location}
                traceEventView={traceEventView}
                metaResults={metaResults}
              />
            )}
          </TraceMetaQuery>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

type TraceViewContentProps = {
  location: Location;
  metaResults: TraceMetaQueryChildrenProps;
  organization: Organization;
  status: 'pending' | 'resolved' | 'error' | 'initial';
  trace: TraceSplitResults<TraceFullDetailed> | null;
  traceEventView: EventView;
  traceSlug: string;
};

function TraceViewContent(props: TraceViewContentProps) {
  const {projects} = useProjects();

  const tree = useMemo(() => {
    if (props.status === 'pending') {
      return TraceTree.Loading({
        project_slug: projects?.[0]?.slug ?? '',
        event_id: props.traceSlug,
      });
    }

    if (props.trace) {
      return TraceTree.FromTrace(props.trace);
    }

    return TraceTree.Empty();
  }, [props.traceSlug, props.trace, props.status, projects]);

  const traceType = useMemo(() => {
    if (props.status !== 'resolved' || !tree) {
      return null;
    }
    return TraceTree.GetTraceType(tree.root);
  }, [props.status, tree]);

  const root = props.trace?.transactions?.[0];
  const rootEventResults = useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${root?.project_slug}:${root?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!(props.trace?.transactions && props.trace.transactions.length > 0),
    }
  );

  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={props.organization}
            location={props.location}
            transaction={{
              project: rootEventResults.data?.projectID ?? '',
              name: rootEventResults.data?.title ?? '',
            }}
            traceSlug={props.traceSlug}
          />
          <Layout.Title data-test-id="trace-header">
            {t('Trace ID: %s', props.traceSlug)}
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <DiscoverButton
              size="sm"
              to={props.traceEventView.getResultsViewUrlTarget(props.organization.slug)}
              onClick={() => {
                trackAnalytics('performance_views.trace_view.open_in_discover', {
                  organization: props.organization,
                });
              }}
            >
              {t('Open in Discover')}
            </DiscoverButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>
          {traceType ? <TraceWarnings type={traceType} /> : null}
          <TraceHeader
            rootEventResults={rootEventResults}
            metaResults={props.metaResults}
            organization={props.organization}
            traces={props.trace}
          />
          <Trace trace={tree} trace_id={props.traceSlug} />
          <TraceFooter
            rootEventResults={rootEventResults}
            organization={props.organization}
            location={props.location}
            traces={props.trace}
            traceEventView={props.traceEventView}
          />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}
