import {Fragment, useMemo, useState} from 'react';
import {RouteComponentProps} from 'react-router';
import styled from '@emotion/styled';

import {Alert} from 'sentry/components/alert';
import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import EventVitals from 'sentry/components/events/eventVitals';
import {SpanDetailProps} from 'sentry/components/events/interfaces/spans/newTraceDetailsSpanDetails';
import * as Layout from 'sentry/components/layouts/thirds';
import ExternalLink from 'sentry/components/links/externalLink';
import Link from 'sentry/components/links/link';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {Tooltip} from 'sentry/components/tooltip';
import {IconPlay} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {EventTransaction, Organization} from 'sentry/types';
import {generateQueryWithTag} from 'sentry/utils';
import {trackAnalytics} from 'sentry/utils/analytics';
import EventView from 'sentry/utils/discover/eventView';
import {formatTagKey} from 'sentry/utils/discover/fields';
import {QueryError} from 'sentry/utils/discover/genericDiscoverQuery';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import {
  TraceError,
  TraceFullDetailed,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import {WEB_VITAL_DETAILS} from 'sentry/utils/performance/vitals/constants';
import {VisuallyCompleteWithData} from 'sentry/utils/performanceForSentry';
import {useApiQuery} from 'sentry/utils/queryClient';
import useRouter from 'sentry/utils/useRouter';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';
import Tags from 'sentry/views/discover/tags';
import Breadcrumb from 'sentry/views/performance/breadcrumb';
import {MetaData} from 'sentry/views/performance/transactionDetails/styles';

import {BrowserDisplay} from '../transactionDetails/eventMetas';

import NewTraceView from './newTraceDetailsTraceView';
import TraceNotFound from './traceNotFound';
import TraceViewDetailPanel from './traceViewDetailPanel';
import {getTraceInfo, hasTraceData, isRootTransaction} from './utils';

type Props = Pick<RouteComponentProps<{traceSlug: string}, {}>, 'params' | 'location'> & {
  dateSelected: boolean;
  error: QueryError | null;
  isLoading: boolean;
  meta: TraceMeta | null;
  organization: Organization;
  traceEventView: EventView;
  traceSlug: string;
  traces: TraceFullDetailed[] | null;
  handleLimitChange?: (newLimit: number) => void;
  orphanErrors?: TraceError[];
};

export enum TraceType {
  ONE_ROOT = 'one_root',
  NO_ROOT = 'no_root',
  MULTIPLE_ROOTS = 'multiple_roots',
  BROKEN_SUBTRACES = 'broken_subtraces',
  ONLY_ERRORS = 'only_errors',
  EMPTY_TRACE = 'empty_trace',
}

export type EventDetail = {
  event: EventTransaction | undefined;
  traceFullDetailedEvent: TraceFullDetailed;
};

function NewTraceDetailsContent(props: Props) {
  const router = useRouter();
  const [detail, setDetail] = useState<EventDetail | SpanDetailProps | undefined>(
    undefined
  );
  const traceInfo = useMemo(
    () => getTraceInfo(props.traces ?? [], props.orphanErrors),
    [props.traces, props.orphanErrors]
  );
  const root = props.traces && props.traces[0];
  const {data: rootEvent, isLoading: isRootEventLoading} = useApiQuery<EventTransaction>(
    [
      `/organizations/${props.organization.slug}/events/${root?.project_slug}:${root?.event_id}/`,
      {
        query: {
          referrer: 'trace-details-summary',
        },
      },
    ],
    {
      staleTime: Infinity,
      enabled: !!(props.traces && props.traces.length > 0),
    }
  );

  const renderTraceLoading = () => {
    return (
      <LoadingContainer>
        <StyledLoadingIndicator />
        {t('Hang in there, as we build your trace view!')}
      </LoadingContainer>
    );
  };

  const renderTraceRequiresDateRangeSelection = () => {
    return <LoadingError message={t('Trace view requires a date range selection.')} />;
  };

  const renderTraceHeader = () => {
    const {meta} = props;
    const errors = meta?.errors ?? traceInfo.errors.size;
    const performanceIssues =
      meta?.performance_issues ?? traceInfo.performanceIssues.size;
    const replay_id = rootEvent?.contexts.replay?.replay_id ?? '';
    return (
      <TraceHeaderContainer>
        {rootEvent && (
          <TraceHeaderRow>
            <MetaData
              headingText={t('User')}
              tooltipText=""
              bodyText={rootEvent?.user?.email ?? rootEvent?.user?.name ?? '\u2014'}
              subtext={null}
            />
            <MetaData
              headingText={t('Browser')}
              tooltipText=""
              bodyText={<BrowserDisplay event={rootEvent} showVersion />}
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
        )}
        <TraceHeaderRow>
          <GuideAnchor target="trace_view_guide_breakdown">
            <MetaData
              headingText={t('Events')}
              tooltipText=""
              bodyText={meta?.transactions ?? traceInfo.transactions.size}
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
                {errors + performanceIssues}
              </Tooltip>
            }
            subtext={null}
          />
          <MetaData
            headingText={t('Total Duration')}
            tooltipText=""
            bodyText={getDuration(
              traceInfo.endTimestamp - traceInfo.startTimestamp,
              2,
              true
            )}
            subtext={null}
          />
        </TraceHeaderRow>
      </TraceHeaderContainer>
    );
  };

  const getTraceType = (): TraceType => {
    const {traces, orphanErrors} = props;

    const {roots, orphans} = (traces ?? []).reduce(
      (counts, trace) => {
        if (isRootTransaction(trace)) {
          counts.roots++;
        } else {
          counts.orphans++;
        }
        return counts;
      },
      {roots: 0, orphans: 0}
    );

    if (roots === 0 && orphans > 0) {
      return TraceType.NO_ROOT;
    }

    if (roots === 1 && orphans > 0) {
      return TraceType.BROKEN_SUBTRACES;
    }

    if (roots > 1) {
      return TraceType.MULTIPLE_ROOTS;
    }

    if (orphanErrors && orphanErrors.length > 1) {
      return TraceType.ONLY_ERRORS;
    }

    if (roots === 1) {
      return TraceType.ONE_ROOT;
    }

    if (roots === 0 && orphans === 0) {
      return TraceType.EMPTY_TRACE;
    }

    throw new Error('Unknown trace type');
  };

  const renderTraceWarnings = () => {
    let warning: React.ReactNode = null;
    const traceType = getTraceType();

    switch (traceType) {
      case TraceType.NO_ROOT:
        warning = (
          <Alert type="info" showIcon>
            <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
              {t(
                'A root transaction is missing. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
              )}
            </ExternalLink>
          </Alert>
        );
        break;
      case TraceType.BROKEN_SUBTRACES:
        warning = (
          <Alert type="info" showIcon>
            <ExternalLink href="https://docs.sentry.io/product/performance/trace-view/#orphan-traces-and-broken-subtraces">
              {t(
                'This trace has broken subtraces. Transactions linked by a dashed line have been orphaned and cannot be directly linked to the root.'
              )}
            </ExternalLink>
          </Alert>
        );
        break;
      case TraceType.MULTIPLE_ROOTS:
        warning = (
          <Alert type="info" showIcon>
            <ExternalLink href="https://docs.sentry.io/product/sentry-basics/tracing/trace-view/#multiple-roots">
              {t('Multiple root transactions have been found with this trace ID.')}
            </ExternalLink>
          </Alert>
        );
        break;
      case TraceType.ONLY_ERRORS:
        warning = (
          <Alert type="info" showIcon>
            {tct(
              "The good news is we know these errors are related to each other. The bad news is that we can't tell you more than that. If you haven't already, [tracingLink: configure performance monitoring for your SDKs] to learn more about service interactions.",
              {
                tracingLink: (
                  <ExternalLink href="https://docs.sentry.io/product/performance/getting-started/" />
                ),
              }
            )}
          </Alert>
        );
        break;
      default:
    }

    return warning;
  };

  const renderFooter = () => {
    const {traceEventView, organization, location, meta, orphanErrors} = props;
    const orphanErrorsCount = orphanErrors?.length ?? 0;
    const transactionsCount = meta?.transactions ?? traceInfo?.transactions.size ?? 0;
    const totalNumOfEvents = transactionsCount + orphanErrorsCount;
    const webVitals = Object.keys(rootEvent?.measurements ?? {})
      .filter(name => Boolean(WEB_VITAL_DETAILS[`measurements.${name}`]))
      .sort();

    return (
      rootEvent && (
        <TraceHeaderWrapper>
          {webVitals.length > 0 && (
            <div style={{flex: 1}}>
              <EventVitals event={rootEvent} />
            </div>
          )}
          <div style={{flex: 1}}>
            <Tags
              generateUrl={(key: string, value: string) => {
                const url = traceEventView.getResultsViewUrlTarget(
                  organization.slug,
                  false
                );
                url.query = generateQueryWithTag(url.query, {
                  key: formatTagKey(key),
                  value,
                });
                return url;
              }}
              totalValues={totalNumOfEvents}
              eventView={traceEventView}
              organization={organization}
              location={location}
            />
          </div>
        </TraceHeaderWrapper>
      )
    );
  };

  const renderContent = () => {
    const {
      dateSelected,
      isLoading,
      error,
      organization,
      location,
      traceEventView,
      traceSlug,
      traces,
      meta,
      orphanErrors,
    } = props;

    if (!dateSelected) {
      return renderTraceRequiresDateRangeSelection();
    }

    const hasOrphanErrors = orphanErrors && orphanErrors.length > 0;
    const onlyOrphanErrors = hasOrphanErrors && (!traces || traces.length === 0);
    if (isLoading || (isRootEventLoading && !onlyOrphanErrors)) {
      return renderTraceLoading();
    }

    const hasData = hasTraceData(traces, orphanErrors);
    if (error !== null || !hasData) {
      return (
        <TraceNotFound
          meta={meta}
          traceEventView={traceEventView}
          traceSlug={traceSlug}
          location={location}
          organization={organization}
        />
      );
    }

    return (
      <Fragment>
        {renderTraceWarnings()}
        {traceInfo && renderTraceHeader()}
        <Margin>
          <VisuallyCompleteWithData id="PerformanceDetails-TraceView" hasData={hasData}>
            <NewTraceView
              traceType={getTraceType()}
              rootEvent={rootEvent}
              traceInfo={traceInfo}
              location={location}
              organization={organization}
              traceEventView={traceEventView}
              traceSlug={traceSlug}
              onRowClick={setDetail}
              traces={traces || []}
              meta={meta}
              orphanErrors={orphanErrors || []}
            />
          </VisuallyCompleteWithData>
        </Margin>
        {renderFooter()}
        <TraceViewDetailPanel
          detail={detail}
          onClose={() => {
            router.replace({
              ...location,
              hash: undefined,
            });
            setDetail(undefined);
          }}
        />
      </Fragment>
    );
  };

  const {organization, location, traceEventView, traceSlug} = props;
  return (
    <Fragment>
      <Layout.Header>
        <Layout.HeaderContent>
          <Breadcrumb
            organization={organization}
            location={location}
            transaction={{
              project: rootEvent?.projectID ?? '',
              name: rootEvent?.title ?? '',
            }}
            traceSlug={traceSlug}
          />
          <Layout.Title data-test-id="trace-header">
            {t('Trace ID: %s', traceSlug)}
          </Layout.Title>
        </Layout.HeaderContent>
        <Layout.HeaderActions>
          <ButtonBar gap={1}>
            <DiscoverButton
              size="sm"
              to={traceEventView.getResultsViewUrlTarget(organization.slug)}
              onClick={() => {
                trackAnalytics('performance_views.trace_view.open_in_discover', {
                  organization,
                });
              }}
            >
              {t('Open in Discover')}
            </DiscoverButton>
          </ButtonBar>
        </Layout.HeaderActions>
      </Layout.Header>
      <Layout.Body>
        <Layout.Main fullWidth>{renderContent()}</Layout.Main>
      </Layout.Body>
    </Fragment>
  );
}

const StyledLoadingIndicator = styled(LoadingIndicator)`
  margin-bottom: 0;
`;

const LoadingContainer = styled('div')`
  font-size: ${p => p.theme.fontSizeLarge};
  color: ${p => p.theme.subText};
  text-align: center;
`;

const ReplayLinkBody = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
`;

const TraceHeaderContainer = styled('div')`
  display: flex;
  align-items: center;
  justify-content: space-between;
`;

const TraceHeaderRow = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

const Margin = styled('div')`
  margin-top: ${space(2)};
`;

const TraceHeaderWrapper = styled('div')`
  display: flex;
  gap: ${space(2)};
`;
export default NewTraceDetailsContent;
