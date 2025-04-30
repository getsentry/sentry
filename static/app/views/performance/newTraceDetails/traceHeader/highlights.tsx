import styled from '@emotion/styled';

import {
  EnvironmentHighlight,
  HighlightsIconSummary,
  ReleaseHighlight,
} from 'sentry/components/events/highlights/highlightsIconSummary';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import type {TraceItemDetailsResponse} from 'sentry/views/explore/hooks/useTraceItemDetails';
import type {TraceRootEventQueryResults} from 'sentry/views/performance/newTraceDetails/traceApi/useTraceRootEvent';
import {isTraceItemDetailsResponse} from 'sentry/views/performance/newTraceDetails/traceApi/utils';

function AttributesHighlights({
  traceItemDetail,
  organization,
  project,
}: {
  organization: Organization;
  project: Project | undefined;
  traceItemDetail: TraceItemDetailsResponse;
}) {
  const {attributes} = traceItemDetail;

  const releaseAttr = attributes?.find(attr => attr.name === 'sentry.release');
  const releaseTag = releaseAttr && {
    key: 'release',
    value: releaseAttr.value.toString(),
  };

  const environmentAttr = attributes?.find(attr => attr.name === 'environment');
  const environmentTag = environmentAttr && {
    key: 'environment',
    value: environmentAttr.value.toString(),
  };

  return (
    <LogsHighlightsWrapper>
      {project && (
        <ReleaseHighlight
          organization={organization}
          projectSlug={project.slug}
          projectId={project.id}
          releaseTag={releaseTag}
        />
      )}
      <EnvironmentHighlight environmentTag={environmentTag} />
    </LogsHighlightsWrapper>
  );
}

const LogsHighlightsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

type HighlightsProps = {
  organization: Organization;
  project: Project | undefined;
  rootEventResults: TraceRootEventQueryResults;
};

function Highlights({rootEventResults, organization, project}: HighlightsProps) {
  if (!rootEventResults.data) {
    return null;
  }

  if (isTraceItemDetailsResponse(rootEventResults.data)) {
    return (
      <AttributesHighlights
        traceItemDetail={rootEventResults.data}
        organization={organization}
        project={project}
      />
    );
  }

  return (
    <HighlightsWrapper>
      <HighlightsIconSummary event={rootEventResults.data} />
    </HighlightsWrapper>
  );
}

const HighlightsWrapper = styled('span')`
  display: flex;
  align-items: center;
  & > div {
    padding: 0;
  }
`;

export default Highlights;
