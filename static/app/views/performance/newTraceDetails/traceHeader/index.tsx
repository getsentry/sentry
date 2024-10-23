import {useCallback} from 'react';
import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import ButtonBar from 'sentry/components/buttonBar';
import DiscoverButton from 'sentry/components/discoverButton';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import FeedbackWidgetButton from 'sentry/components/feedback/widget/feedbackWidgetButton';
import * as Layout from 'sentry/components/layouts/thirds';
import Placeholder from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import {trackAnalytics} from 'sentry/utils/analytics';
import type EventView from 'sentry/utils/discover/eventView';
import {SavedQueryDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {hasDatasetSelector} from 'sentry/views/dashboards/utils';
import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import TraceConfigurations from '../traceConfigurations';
import type {TraceTree} from '../traceModels/traceTree';
import {useHasTraceNewUi} from '../useHasTraceNewUi';

import {getTraceViewBreadcrumbs} from './breadcrumbs';
import {Meta} from './meta';
import {Title} from './title';

interface TraceMetadataHeaderProps {
  metaResults: TraceMetaQueryResults;
  organization: Organization;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  traceEventView: EventView;
  traceSlug: string;
  tree: TraceTree;
}

function NewTraceMetadataHeader({
  rootEventResults,
  metaResults,
  tree,
  traceSlug,
  organization,
}: TraceMetadataHeaderProps) {
  const location = useLocation();

  return (
    <Layout.Header>
      <HeaderContent>
        <HeaderRow>
          <Breadcrumbs crumbs={getTraceViewBreadcrumbs(organization, location)} />
        </HeaderRow>
        <HeaderRow>
          <Title rootEventResults={rootEventResults} traceSlug={traceSlug} tree={tree} />
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
              <HighlightsIconSummary event={rootEventResults.data} />
            </StyledWrapper>
            <ProjectsRenderer
              projectSlugs={Array.from(tree.project_slugs)}
              visibleAvatarSize={24}
              maxVisibleProjects={3}
            />
          </HeaderRow>
        ) : null}
      </HeaderContent>
    </Layout.Header>
  );
}

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

const StyledBreak = styled('hr')`
  margin: 0;
  border-color: ${p => p.theme.border};
`;

const StyledWrapper = styled('span')`
  display: flex;
  align-items: center;
  & > div {
    padding: 0;
  }
`;

function PlaceHolder({organization}: {organization: Organization}) {
  const location = useLocation();

  return (
    <Layout.Header>
      <HeaderContent>
        <HeaderRow>
          <Breadcrumbs crumbs={getTraceViewBreadcrumbs(organization, location)} />
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
    </Layout.Header>
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

function LegacyTraceMetadataHeader(props: TraceMetadataHeaderProps) {
  const location = useLocation();

  const trackOpenInDiscover = useCallback(() => {
    trackAnalytics('performance_views.trace_view.open_in_discover', {
      organization: props.organization,
    });
  }, [props.organization]);

  return (
    <Layout.Header>
      <Layout.HeaderContent>
        <Breadcrumbs crumbs={getTraceViewBreadcrumbs(props.organization, location)} />
      </Layout.HeaderContent>
      <Layout.HeaderActions>
        <ButtonBar gap={1}>
          <TraceConfigurations rootEventResults={props.rootEventResults} />
          <DiscoverButton
            size="sm"
            to={props.traceEventView.getResultsViewUrlTarget(
              props.organization.slug,
              false,
              hasDatasetSelector(props.organization)
                ? SavedQueryDatasets.ERRORS
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
  const hasNewTraceViewUi = useHasTraceNewUi();

  const isLoading =
    props.metaResults.isLoading ||
    props.rootEventResults.isPending ||
    props.tree.type === 'loading';

  if (hasNewTraceViewUi) {
    return isLoading ? (
      <PlaceHolder organization={props.organization} />
    ) : (
      <NewTraceMetadataHeader {...props} />
    );
  }

  return <LegacyTraceMetadataHeader {...props} />;
}
