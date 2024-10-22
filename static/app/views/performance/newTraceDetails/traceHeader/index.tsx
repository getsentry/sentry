import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import {CopyToClipboardButton} from 'sentry/components/copyToClipboardButton';
import DiscoverButton from 'sentry/components/discoverButton';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import TimeSince from 'sentry/components/timeSince';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import getDuration from 'sentry/utils/duration/getDuration';
import type {
  TraceErrorOrIssue,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';

import {HeaderInfo, MetaData, SectionBody} from '../../transactionDetails/styles';
import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import TraceConfigurations from '../traceConfigurations';
import {TraceDrawerComponents} from '../traceDrawer/details/styles';
import {TraceShape, type TraceTree} from '../traceModels/traceTree';

import {getTraceViewBreadcrumbs} from './breadcrumbs';

interface ActionsProps {
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
}

function Actions(props: ActionsProps) {
  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <ButtonBar gap={1}>
      <TraceConfigurations rootEventResults={props.rootEventResults} />
      <DiscoverButton
        size="sm"
        to={props.traceEventView.getResultsViewUrlTarget(
          props.organization.slug,
          false,
          hasDatasetSelector(props.organization) ? SavedQueryDatasets.ERRORS : undefined
        )}
        onClick={trackOpenInDiscover}
      >
        {t('Open in Discover')}
      </DiscoverButton>
      <FeedbackWidgetButton />
    </ButtonBar>
  );
}

interface TraceMetadataHeaderProps {
  metaResults: TraceMetaQueryResults;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string;
  tree: TraceTree;
}

export function TraceMetadataHeader({
  rootEventResults,
  metaResults,
  tree,
  traceSlug,
  traceEventView,
  organization,
}: TraceMetadataHeaderProps) {
  const location = useLocation();

  const title =
    tree.shape === TraceShape.ONE_ROOT
      ? `${rootEventResults.data?.title}`
      : t('Missing Trace Root');
  const op = rootEventResults.data?.contexts.trace?.op;

  return (
    <Layout.Header>
      <HeaderContent>
        <HeaderRow>
          <Breadcrumbs crumbs={getTraceViewBreadcrumbs(organization, location)} />
          <Actions
            organization={organization}
            rootEventResults={rootEventResults}
            traceEventView={traceEventView}
          />
        </HeaderRow>
        <HeaderRow>
          <span>
            <HeaderTitle>
              {tree.shape === TraceShape.ONE_ROOT ? (
                op ? (
                  <Fragment>
                    <strong>{op} - </strong>
                    {title}
                  </Fragment>
                ) : null
              ) : (
                t('Missing Trace Root')
              )}
            </HeaderTitle>
            <HeaderSubtitle>
              ID: {traceSlug}
              <CopyToClipboardButton
                borderless
                size="zero"
                iconSize="xs"
                text={traceSlug}
              />
            </HeaderSubtitle>
          </span>
          <Meta
            organization={organization}
            rootEventResults={rootEventResults}
            tree={tree}
            meta={metaResults.data}
          />
        </HeaderRow>
        <StyledBreak />
        {rootEventResults.data ? (
          <HeaderRow>
            <StyledWrapper>
              <HighlightsIconSummary event={rootEventResults.data} iconSize="lg" />
            </StyledWrapper>
            <ProjectsRenderer
              projectSlugs={Array.from(tree.project_slugs)}
              maxVisibleProjects={3}
            />
          </HeaderRow>
        ) : null}
      </HeaderContent>
    </Layout.Header>
  );
}

interface MetaProps {
  meta: TraceMeta | undefined;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
}

function Meta(props: MetaProps) {
  const traceNode = props.tree.root.children[0];

  const uniqueErrorIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.errors) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniquePerformanceIssues = useMemo(() => {
    if (!traceNode) {
      return [];
    }

    const unique: TraceErrorOrIssue[] = [];
    const seenIssues: Set<number> = new Set();

    for (const issue of traceNode.performance_issues) {
      if (seenIssues.has(issue.issue_id)) {
        continue;
      }
      seenIssues.add(issue.issue_id);
      unique.push(issue);
    }

    return unique;
  }, [traceNode]);

  const uniqueIssuesCount = uniqueErrorIssues.length + uniquePerformanceIssues.length;

  return (
    <MetaWrapper>
      <MetaData
        headingText={t('Issues')}
        tooltipText=""
        bodyText={
          uniqueIssuesCount > 0 ? (
            <TraceDrawerComponents.IssuesLink node={traceNode}>
              {uniqueIssuesCount}
            </TraceDrawerComponents.IssuesLink>
          ) : uniqueIssuesCount === 0 ? (
            0
          ) : (
            '\u2014'
          )
        }
        subtext={null}
      />
      <MetaData
        headingText={t('Events')}
        tooltipText=""
        bodyText={(props.meta?.transactions ?? 0) + (props.meta?.errors ?? 0)}
        subtext={null}
      />
      {traceNode ? (
        <MetaData
          headingText={t('Age')}
          tooltipText=""
          bodyText={
            <TimeSince
              unitStyle="extraShort"
              date={new Date(traceNode.space[0])}
              tooltipShowSeconds
              suffix=""
            />
          }
          subtext={null}
        />
      ) : null}
      {traceNode ? (
        <MetaData
          headingText={t('Trace Duration')}
          tooltipText=""
          bodyText={
            traceNode.space[1] > 0
              ? getDuration(traceNode.space[1] / 1e3, 2, true)
              : '\u2014'
          }
          subtext={null}
        />
      ) : null}
    </MetaWrapper>
  );
}

const MetaWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};

  ${HeaderInfo} {
    min-height: 0;
  }

  ${SectionBody} {
    padding: 0;
  }
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;

  &:not(:first-child) {
    margin: ${space(1)} 0;
  }

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    flex-direction: column;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const HeaderTitle = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  ${p => p.theme.overflowEllipsis};
`;

const HeaderSubtitle = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  color: ${p => p.theme.subText};
`;

const StyledBreak = styled('hr')`
  margin: 0;
  border-color: ${p => p.theme.border};
`;

const StyledWrapper = styled('div')`
  & > div {
    padding: 0;
  }
`;
