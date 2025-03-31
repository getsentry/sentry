import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import type {Location} from 'history';

import Feature from 'sentry/components/acl/feature';
import Breadcrumbs from 'sentry/components/breadcrumbs';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {IconMegaphone} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useFeedbackForm} from 'sentry/utils/useFeedbackForm';
import {useLocation} from 'sentry/utils/useLocation';
import {useSyncedLocalStorageState} from 'sentry/utils/useSyncedLocalStorageState';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';
import {useTraceStateDispatch} from 'sentry/views/performance/newTraceDetails/traceState/traceStateProvider';

import {isRootEvent} from '../../traceDetails/utils';
import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import TraceConfigurations from '../traceConfigurations';
import {isEAPTraceNode, isTraceNode} from '../traceGuards';
import type {TraceTree} from '../traceModels/traceTree';
import {useHasTraceNewUi} from '../useHasTraceNewUi';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

export interface TraceMetadataHeaderProps {
  metaResults: TraceMetaQueryResults;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string;
  tree: TraceTree;
}

function FeedbackButton() {
  const openForm = useFeedbackForm();

  return openForm ? (
    <Button
      size="xs"
      aria-label="trace-view-feedback"
      icon={<IconMegaphone size="xs" />}
      onClick={() =>
        openForm({
          messagePlaceholder: t('How can we make the trace view better for you?'),
          tags: {
            ['feedback.source']: 'trace-view',
            ['feedback.owner']: 'performance',
          },
        })
      }
    >
      {t('Give Feedback')}
    </Button>
  ) : null;
}

export const TRACE_FORMAT_PREFERENCE_KEY = 'trace_format_preference';

export function ToggleTraceFormatButton({
  organization,
}: {
  location: Location;
  organization: Organization;
}) {
  const [storedTraceFormat, setStoredTraceFormat] = useSyncedLocalStorageState(
    TRACE_FORMAT_PREFERENCE_KEY,
    'non-eap'
  );

  return (
    <Feature organization={organization} features="trace-spans-format">
      <Button
        size="xs"
        aria-label="toggle-trace-format-btn"
        onClick={() => {
          setStoredTraceFormat(storedTraceFormat === 'eap' ? 'non-eap' : 'eap');
        }}
      >
        {storedTraceFormat === 'eap'
          ? t('Switch to Non-EAP Trace')
          : t('Switch to EAP Trace')}
      </Button>
    </Feature>
  );
}

function PlaceHolder({organization}: {organization: Organization}) {
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const location = useLocation();

  return (
    <HeaderLayout>
      <HeaderContent>
        <HeaderRow>
          <Breadcrumbs
            crumbs={getTraceViewBreadcrumbs(
              organization,
              location,
              moduleURLBuilder,
              view
            )}
          />
          <ButtonBar gap={1}>
            <ToggleTraceFormatButton location={location} organization={organization} />
            <FeedbackButton />
          </ButtonBar>
        </HeaderRow>
        <HeaderRow>
          <PlaceHolderTitleWrapper>
            <StyledPlaceholder _width={300} _height={20} />
            <StyledPlaceholder _width={200} _height={18} />
          </PlaceHolderTitleWrapper>
          <PlaceHolderTitleWrapper>
            <StyledPlaceholder _width={300} _height={18} />
            <StyledPlaceholder _width={300} _height={24} />
          </PlaceHolderTitleWrapper>
        </HeaderRow>
        <StyledBreak />
        <HeaderRow>
          <PlaceHolderHighlightWrapper>
            <StyledPlaceholder _width={150} _height={20} />
            <StyledPlaceholder _width={150} _height={20} />
            <StyledPlaceholder _width={150} _height={20} />
          </PlaceHolderHighlightWrapper>
          <StyledPlaceholder _width={50} _height={28} />
        </HeaderRow>
      </HeaderContent>
    </HeaderLayout>
  );
}

const PlaceHolderTitleWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  gap: ${space(0.5)};
`;

const PlaceHolderHighlightWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(1)};
`;

const StyledPlaceholder = styled(Placeholder)<{_height: number; _width: number}>`
  border-radius: ${p => p.theme.borderRadius};
  height: ${p => p._height}px;
  width: ${p => p._width}px;
`;

const CANDIDATE_TRACE_TITLE_OPS = ['pageload', 'navigation'];

export const getRepresentativeEvent = (
  tree: TraceTree
): TraceTree.Transaction | TraceTree.EAPSpan | null => {
  const traceNode = tree.root.children[0];

  if (!traceNode) {
    return null;
  }

  if (!isTraceNode(traceNode) && !isEAPTraceNode(traceNode)) {
    throw new TypeError('Not trace node');
  }

  let firstRootEvent: TraceTree.Transaction | TraceTree.EAPSpan | null = null;
  let candidateEvent: TraceTree.Transaction | TraceTree.EAPSpan | null = null;
  let firstEvent: TraceTree.Transaction | TraceTree.EAPSpan | null = null;

  const events = isTraceNode(traceNode) ? traceNode.value.transactions : traceNode.value;
  for (const event of events) {
    // If we find a root transaction, we can stop looking and use it for the title.
    if (!firstRootEvent && isRootEvent(event)) {
      firstRootEvent = event;
      break;
    } else if (
      // If we haven't found a root transaction, but we found a candidate transaction
      // with an op that we care about, we can use it for the title. We keep looking for
      // a root.
      !candidateEvent &&
      CANDIDATE_TRACE_TITLE_OPS.includes(
        'transaction.op' in event ? event['transaction.op'] : event.op
      )
    ) {
      candidateEvent = event;
      continue;
    } else if (!firstEvent) {
      // If we haven't found a root or candidate transaction, we can use the first transaction
      // in the trace for the title.
      firstEvent = event;
    }
  }

  return firstRootEvent ?? candidateEvent ?? firstEvent;
};

function LegacyTraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs
          crumbs={getTraceViewBreadcrumbs(
            props.organization,
            location,
            moduleURLBuilder,
            view
          )}
        />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <TraceConfigurations rootEventResults={props.rootEventResults} />
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(
              props.organization,
              false,
              hasDatasetSelector(props.organization)
                ? SavedQueryDatasets.TRANSACTIONS
                : undefined
            )}
            onClick={trackOpenInDiscover}
          >
            {t('Open in Discover')}
          </DiscoverButton>

          <FeedbackWidgetButton />
        </ButtonBar>
      </Layout.HeaderActions>
    </Layout.Header>
  );
}

export function TraceMetaDataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();
  const hasNewTraceViewUi = useHasTraceNewUi();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const dispatch = useTraceStateDispatch();

  const onProjectClick = useCallback(
    (projectSlug: string) => {
      dispatch({type: 'set query', query: `project:${projectSlug}`, source: 'external'});
    },
    [dispatch]
  );

  const projectSlugs = useMemo(() => {
    return Array.from(props.tree.projects.values()).map(project => project.slug);
  }, [props.tree.projects]);

  if (!hasNewTraceViewUi) {
    return <LegacyTraceMetadataHeader {...props} />;
  }

  const isLoading =
    props.metaResults.status === 'pending' ||
    props.rootEventResults.isLoading ||
    props.tree.type === 'loading';

  if (isLoading) {
    return <PlaceHolder organization={props.organization} />;
  }

  const representativeTransaction = getRepresentativeEvent(props.tree);

  return (
    <HeaderLayout>
      <HeaderContent>
        <HeaderRow>
          <Breadcrumbs
            crumbs={getTraceViewBreadcrumbs(
              props.organization,
              location,
              moduleURLBuilder,
              view
            )}
          />
          <ButtonBar gap={1}>
            <ToggleTraceFormatButton
              location={location}
              organization={props.organization}
            />
            <FeedbackButton />
          </ButtonBar>
        </HeaderRow>
        <HeaderRow>
          <Title
            tree={props.tree}
            traceSlug={props.traceSlug}
            representativeTransaction={representativeTransaction}
          />
          <Meta
            organization={props.organization}
            rootEventResults={props.rootEventResults}
            tree={props.tree}
            meta={props.metaResults.data}
            representativeTransaction={representativeTransaction}
          />
        </HeaderRow>
        {props.rootEventResults.data ? (
          <Fragment>
            <StyledBreak />
            <HeaderRow>
              <StyledWrapper>
                <HighlightsIconSummary event={props.rootEventResults.data} />
              </StyledWrapper>
              <ProjectsRendererWrapper>
                <ProjectsRenderer
                  disableLink
                  onProjectClick={onProjectClick}
                  projectSlugs={projectSlugs}
                  visibleAvatarSize={24}
                  maxVisibleProjects={3}
                />
              </ProjectsRendererWrapper>
            </HeaderRow>
          </Fragment>
        ) : null}
      </HeaderContent>
    </HeaderLayout>
  );
}

// We cannot change the cursor of the ProjectBadge component so we need to wrap it in a div
const ProjectsRendererWrapper = styled('div')`
  img {
    cursor: pointer;
  }
`;

const HeaderLayout = styled('div')`
  background-color: ${p => p.theme.background};
  padding: ${space(1)} ${space(3)} ${space(1)} ${space(3)};
  border-bottom: 1px solid ${p => p.theme.border};
`;

const HeaderRow = styled('div')`
  display: flex;
  justify-content: space-between;
  gap: ${space(2)};
  align-items: center;

  @media (max-width: ${p => p.theme.breakpoints.small}) {
    gap: ${space(1)};
    flex-direction: column;
  }
`;

const HeaderContent = styled('div')`
  display: flex;
  flex-direction: column;
`;

const StyledBreak = styled('hr')`
  margin: ${space(1)} 0;
  border-color: ${p => p.theme.border};
`;

const StyledWrapper = styled('span')`
  display: flex;
  align-items: center;
  & > div {
    padding: 0;
  }
`;
