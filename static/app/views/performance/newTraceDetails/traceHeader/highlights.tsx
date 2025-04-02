import styled from '@emotion/styled';

import {
  EnvironmentHighlight,
  HighlightsIconSummary,
  ReleaseHighlight,
} from 'sentry/components/events/highlights/highlightsIconSummary';
import {space} from 'sentry/styles/space';
import type {EventTransaction} from 'sentry/types/event';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {DiscoverDatasets} from 'sentry/utils/discover/types';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import {
  TraceShape,
  type TraceTree,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function LogsHighlights({
  logs,
  organization,
  project,
}: {
  logs: OurLogsResponseItem[];
  organization: Organization;
  project: Project | undefined;
}) {
  const log = logs[0];

  const {data, isPending} = useTraceItemDetails({
    traceItemId: String(log![OurLogKnownFieldKey.ID]),
    projectId: String(log![OurLogKnownFieldKey.PROJECT_ID]),
    traceId: String(log![OurLogKnownFieldKey.TRACE_ID]),
    dataset: DiscoverDatasets.OURLOGS,
    referrer: 'api.explore.log-item-details', // TODO Abdullah Khan: Add new for trace view headerreferrer
    enabled: !!logs,
  });

  if (!logs) {
    return null;
  }

  if (isPending) {
    return (
      <LogsHighlightsWrapper>
        <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
        <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
        <TraceHeaderComponents.StyledPlaceholder _width={150} _height={20} />
      </LogsHighlightsWrapper>
    );
  }

  const attributes = data?.attributes;
  const releaseAttr = attributes?.find(attr => attr.name === 'release');
  const environmentAttr = attributes?.find(attr => attr.name === 'environment');

  return (
    <LogsHighlightsWrapper>
      {releaseAttr && project && (
        <ReleaseHighlight
          organization={organization}
          projectSlug={project.slug}
          projectId={project.id}
          releaseTag={{
            key: 'release',
            value: releaseAttr.value.toString(),
          }}
        />
      )}
      {environmentAttr && (
        <EnvironmentHighlight
          environmentTag={{
            key: 'environment',
            value: environmentAttr.value.toString(),
          }}
        />
      )}
    </LogsHighlightsWrapper>
  );
}

const LogsHighlightsWrapper = styled('div')`
  display: flex;
  align-items: center;
  gap: ${space(2)};
`;

type HighlightsProps = {
  logs: OurLogsResponseItem[];
  organization: Organization;
  project: Project | undefined;
  rootEventResults: UseApiQueryResult<EventTransaction, RequestError>;
  tree: TraceTree;
};

function Highlights({
  rootEventResults,
  tree,
  logs,
  organization,
  project,
}: HighlightsProps) {
  if (tree.shape === TraceShape.EMPTY_TRACE && logs.length > 0) {
    return <LogsHighlights logs={logs} organization={organization} project={project} />;
  }

  if (!rootEventResults.data) {
    return null;
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
