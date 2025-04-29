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
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {useTraceItemDetails} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {
  OurLogKnownFieldKey,
  type OurLogsResponseItem,
} from 'sentry/views/explore/logs/types';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {TraceHeaderComponents} from 'sentry/views/performance/newTraceDetails/traceHeader/styles';
import {
  TraceShape,
  type TraceTree,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

function LogsHighlights({
  log,
  organization,
  project,
}: {
  log: OurLogsResponseItem;
  organization: Organization;
  project: Project | undefined;
}) {
  const {data, isPending} = useTraceItemDetails({
    traceItemId: String(log[OurLogKnownFieldKey.ID]),
    projectId: String(log[OurLogKnownFieldKey.PROJECT_ID]),
    traceId: String(log[OurLogKnownFieldKey.TRACE_ID]),
    traceItemType: TraceItemDataset.LOGS,
    referrer: 'api.explore.log-item-details', // TODO Abdullah Khan: Add new referrer for trace view header
    enabled: true,
  });

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
  logs: OurLogsResponseItem[] | undefined;
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
  if (tree.shape === TraceShape.EMPTY_TRACE && logs && logs.length > 0) {
    return (
      <LogsHighlights
        log={logs[0] as OurLogsResponseItem}
        organization={organization}
        project={project}
      />
    );
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
