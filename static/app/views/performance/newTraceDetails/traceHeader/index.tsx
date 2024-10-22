import styled from '@emotion/styled';

import Breadcrumbs from 'sentry/components/breadcrumbs';
import {HighlightsIconSummary} from 'sentry/components/events/highlights/highlightsIconSummary';
import * as Layout from 'sentry/components/layouts/thirds';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type EventView from 'sentry/utils/discover/eventView';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useLocation} from 'sentry/utils/useLocation';
import {ProjectsRenderer} from 'sentry/views/explore/tables/tracesTable/fieldRenderers';

import type {TraceMetaQueryResults} from '../traceApi/useTraceMeta';
import type {TraceTree} from '../traceModels/traceTree';

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

export function TraceMetadataHeader({
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

const StyledWrapper = styled('div')`
  & > div {
    padding: 0;
  }
`;
