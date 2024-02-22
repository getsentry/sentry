import {Fragment, useMemo, useState} from 'react';
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
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
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

import Breadcrumb from '../breadcrumb';

import Trace from './trace';
import TraceHeader from './traceHeader';
import {TraceTree} from './traceTree';
import TraceWarnings from './traceWarnings';

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

  const _traceEventView = useMemo(() => {
    const {start, end, statsPeriod} = dateSelection;

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
  }, [dateSelection, traceSlug]);

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
            {trace => (
              <TraceMetaQuery
                location={location}
                orgSlug={organization.slug}
                traceId={traceSlug}
                start={dateSelection.start}
                end={dateSelection.end}
                statsPeriod={dateSelection.statsPeriod}
              >
                {metaResults => (
                  <TraceViewContent
                    traceSplitResult={trace?.traces}
                    traceSlug={traceSlug}
                    organization={organization}
                    location={location}
                    traceEventView={_traceEventView}
                    metaResults={metaResults}
                  />
                )}
              </TraceMetaQuery>
            )}
          </TraceFullDetailedQuery>
        </NoProjectMessage>
      </Layout.Page>
    </SentryDocumentTitle>
  );
}

type TraceViewContentProps = {
  location: Location;
  metaResults: TraceMetaQueryChildrenProps;
  organization: Organization;
  traceEventView: EventView;
  traceSlug: string;
  traceSplitResult: TraceSplitResults<TraceFullDetailed> | null;
};

function TraceViewContent(props: TraceViewContentProps) {
  const rootEvent =
    props.traceSplitResult?.transactions?.[0] ||
    props.traceSplitResult?.orphan_errors?.[0];
  const {projects} = useProjects();
  const tree = useMemo(() => {
    if (!props.traceSplitResult) {
      return TraceTree.Loading({
        project_slug: projects?.[0]?.slug ?? '',
        event_id: props.traceSlug,
      });
    }

    return TraceTree.FromTrace(props.traceSplitResult);
  }, [props.traceSlug, props.traceSplitResult, projects]);

  const traceType = useMemo(() => {
    return TraceTree.GetTraceType(tree.root);
  }, [tree]);

  const rootEventResults = useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${rootEvent?.project_slug}:${rootEvent?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: 0,
      enabled: !!(
        (props.traceSplitResult?.transactions &&
          props.traceSplitResult.transactions.length > 0) ||
        (props.traceSplitResult?.orphan_errors &&
          props.traceSplitResult.orphan_errors.length > 0)
      ),
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
            traces={props.traceSplitResult}
          />
          <Trace trace={tree} trace_id={props.traceSlug} />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}
