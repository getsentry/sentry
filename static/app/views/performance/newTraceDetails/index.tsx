import {Fragment, useMemo, useState} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Link from 'sentry/components/links/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import NoProjectMessage from 'sentry/components/noProjectMessage';
import {normalizeDateTimeParams} from 'sentry/components/organizations/pageFilters/parse';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {Tooltip} from 'sentry/components/tooltip';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import {IconPlay} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction, Organization} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {TraceFullDetailedQuery} from 'sentry/utils/performance/quickTrace/traceFullQuery';
import TraceMetaQuery, {
  type TraceMetaQueryChildrenProps,
} from 'sentry/utils/performance/quickTrace/traceMetaQuery';
import type {
  TraceFullDetailed,
  TraceSplitResults,
} from 'sentry/utils/performance/quickTrace/types';
import {useApiQuery, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import useProjects from 'sentry/utils/useProjects';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import Breadcrumb from '../breadcrumb';
import {getTraceInfo} from '../traceDetails/utils';
import {BrowserDisplay} from '../transactionDetails/eventMetas';
import {MetaData} from '../transactionDetails/styles';

import Trace from './trace';
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

type TraceHeaderProps = {
  metaResults: TraceMetaQueryChildrenProps;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceSplitResult: TraceSplitResults<TraceFullDetailed> | null;
};

function TraceHeader(props: TraceHeaderProps) {
  const {metaResults, rootEventResults, traceSplitResult, organization} = props;
  const {meta, isLoading: metaLoading} = metaResults;
  const {data: rootEvent, isLoading: rootEventLoading} = rootEventResults;
  const errors = meta?.errors || 0;
  const performanceIssues = meta?.performance_issues || 0;
  const replay_id = rootEvent?.contexts.replay?.replay_id ?? '';
  const traceInfo = getTraceInfo(
    traceSplitResult?.transactions,
    traceSplitResult?.orphan_errors
  );
  const loadingIndicator = <LoadingIndicator size={20} mini />;

  return (
    <TraceHeaderContainer>
      <TraceHeaderRow>
        <MetaData
          headingText={t('User')}
          tooltipText=""
          bodyText={
            rootEventLoading
              ? loadingIndicator
              : rootEvent?.user?.email ?? rootEvent?.user?.name ?? '\u2014'
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Browser')}
          tooltipText=""
          bodyText={
            rootEventLoading ? (
              loadingIndicator
            ) : rootEvent ? (
              <BrowserDisplay event={rootEvent} showVersion />
            ) : (
              '\u2014'
            )
          }
          subtext={null}
        />
        {replay_id && (
          <MetaData
            headingText={t('Replay')}
            tooltipText=""
            bodyText={
              <Link
                to={normalizeUrl(
                  `/organizations/${organization.slug}/replays/${replay_id}/`
                )}
              >
                <ReplayLinkBody>
                  {getShortEventId(replay_id)}
                  <IconPlay size="xs" />
                </ReplayLinkBody>
              </Link>
            }
            subtext={null}
          />
        )}
      </TraceHeaderRow>
      <TraceHeaderRow>
        <GuideAnchor target="trace_view_guide_breakdown">
          <MetaData
            headingText={t('Events')}
            tooltipText=""
            bodyText={metaLoading ? loadingIndicator : meta?.transactions ?? '\u2014'}
            subtext={null}
          />
        </GuideAnchor>
        <MetaData
          headingText={t('Issues')}
          tooltipText=""
          bodyText={
            <Tooltip
              title={
                errors + performanceIssues > 0 ? (
                  <Fragment>
                    <div>{tn('%s error issue', '%s error issues', errors)}</div>
                    <div>
                      {tn(
                        '%s performance issue',
                        '%s performance issues',
                        performanceIssues
                      )}
                    </div>
                  </Fragment>
                ) : null
              }
              showUnderline
              position="bottom"
            >
              {metaLoading
                ? loadingIndicator
                : errors || performanceIssues
                  ? errors + performanceIssues
                  : 0}
            </Tooltip>
          }
          subtext={null}
        />
        <MetaData
          headingText={t('Total Duration')}
          tooltipText=""
          bodyText={
            traceInfo.startTimestamp && traceInfo.endTimestamp
              ? getDuration(traceInfo.endTimestamp - traceInfo.startTimestamp, 2, true)
              : loadingIndicator
          }
          subtext={null}
        />
      </TraceHeaderRow>
    </TraceHeaderContainer>
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
  const rootEvent = props.traceSplitResult?.transactions?.[0];
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
        props.traceSplitResult?.transactions &&
        props.traceSplitResult.transactions.length > 0
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
            traceSplitResult={props.traceSplitResult}
          />
          <Trace trace={tree} trace_id={props.traceSlug} />
        </Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

const FlexBox = styled('div')`
  display: flex;
  align-items: center;
`;

const TraceHeaderContainer = styled(FlexBox)`
  justify-content: space-between;
`;

const TraceHeaderRow = styled(FlexBox)`
  gap: ${space(2)};
`;

const ReplayLinkBody = styled(FlexBox)`
  gap: ${space(0.25)};
`;
