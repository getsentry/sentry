import {useTheme, type Theme} from '@emotion/react';
import type {Location} from 'history';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {
  useTraceItemDetails,
  type TraceItemDetailsResponse,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {Attributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/attributes';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {BaseNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/baseNode';
import type {UptimeCheckNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckNode';

function UptimeNodeDetailsHeader({
  node,
  organization,
  onTabScrollToNode,
  hideNodeActions,
}: {
  node: UptimeCheckNode;
  onTabScrollToNode: (node: BaseNode) => void;
  organization: Organization;
  hideNodeActions?: boolean;
}) {
  const itemId = node.value.event_id;
  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>
            {t('Uptime Check Request')}
          </TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            subTitle={`Check ID: ${itemId}`}
            clipboardText={itemId}
          />
        </TraceDrawerComponents.LegacyTitleText>
      </TraceDrawerComponents.Title>
      {!hideNodeActions && (
        <TraceDrawerComponents.NodeActions
          node={node}
          organization={organization}
          onTabScrollToNode={onTabScrollToNode}
        />
      )}
    </TraceDrawerComponents.HeaderContainer>
  );
}

export function UptimeNodeDetails(props: TraceTreeNodeDetailsProps<UptimeCheckNode>) {
  const {node} = props;
  const location = useLocation();
  const theme = useTheme();
  const {projects} = useProjects();

  const project = projects.find(
    proj => proj.slug === (node.value.project_slug ?? node.projectSlug)
  );

  return (
    <UptimeSpanNodeDetails
      {...props}
      node={node}
      project={project}
      location={location}
      theme={theme}
    />
  );
}

type UptimeSpanNodeDetailsProps = TraceTreeNodeDetailsProps<UptimeCheckNode> & {
  location: Location;
  project: Project | undefined;
  theme: Theme;
};

function UptimeSpanNodeDetails(props: UptimeSpanNodeDetailsProps) {
  const {node, traceId} = props;
  const {
    data: traceItemData,
    isPending: isTraceItemPending,
    isError: isTraceItemError,
  } = useTraceItemDetails({
    traceItemId: node.value.event_id,
    projectId: node.value.project_id.toString(),
    traceId: node.extra?.replayTraceSlug ?? traceId,
    traceItemType: TraceItemDataset.UPTIME_RESULTS,
    referrer: 'api.explore.log-item-details', // TODO: change to span details
    enabled: true,
  });

  if (isTraceItemPending) {
    return <LoadingIndicator />;
  }

  if (isTraceItemError) {
    return <LoadingError message={t('Failed to fetch span details')} />;
  }

  return <UptimeSpanNodeDetailsContent {...props} traceItemData={traceItemData} />;
}

type UptimeSpanNodeDetailsContentProps = UptimeSpanNodeDetailsProps & {
  traceItemData: TraceItemDetailsResponse;
};

function UptimeSpanNodeDetailsContent({
  hideNodeActions,
  node,
  onTabScrollToNode,
  organization,
  project,
  theme,
  traceItemData,
}: UptimeSpanNodeDetailsContentProps) {
  const location = useLocation();
  const attributes = traceItemData.attributes;

  return (
    <TraceDrawerComponents.DetailContainer>
      <UptimeNodeDetailsHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        hideNodeActions={hideNodeActions}
      />
      <TraceDrawerComponents.BodyContainer>
        <Attributes
          node={node}
          attributes={attributes}
          theme={theme}
          location={location}
          organization={organization}
          project={project}
        />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
