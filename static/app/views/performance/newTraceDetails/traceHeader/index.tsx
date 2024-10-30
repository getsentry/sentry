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
import {useModuleURLBuilder} from 'sentry/views/insights/common/utils/useModuleURL';
import {useDomainViewFilters} from 'sentry/views/insights/pages/useFilters';

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

function PlaceHolder({organization}: {organization: Organization}) {
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);
  const location = useLocation();

  return (
    <Layout.Header>
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
  const location = useLocation();
  const hasNewTraceViewUi = useHasTraceNewUi();
  const {view} = useDomainViewFilters();
  const moduleURLBuilder = useModuleURLBuilder(true);

  if (!hasNewTraceViewUi) {
    return <LegacyTraceMetadataHeader {...props} />;
  }

  const isLoading =
    props.metaResults.status === 'pending' ||
    props.rootEventResults.isPending ||
    props.tree.type === 'loading';

  if (isLoading) {
    return <PlaceHolder organization={props.organization} />;
  }

  return (
    <Layout.Header>
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
        </HeaderRow>
        <HeaderRow>
          <Title traceSlug={props.traceSlug} tree={props.tree} />
          <Meta
            organization={props.organization}
            rootEventResults={props.rootEventResults}
            tree={props.tree}
            meta={props.metaResults.data}
          />
        </HeaderRow>
        <StyledBreak />
        {props.rootEventResults.data ? (
          <HeaderRow>
            <StyledWrapper>
              <HighlightsIconSummary event={props.rootEventResults.data} />
            </StyledWrapper>
            <ProjectsRenderer
              projectSlugs={Array.from(props.tree.projects).map(({slug}) => slug)}
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
