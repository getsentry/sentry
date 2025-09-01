import {type Theme, useTheme} from '@emotion/react';
import type {Location} from 'history';

import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Project} from 'sentry/types/project';
import {useLocation} from 'sentry/utils/useLocation';
import useProjects from 'sentry/utils/useProjects';
import {prettifyAttributeName} from 'sentry/views/explore/components/traceItemAttributes/utils';
import {
  type TraceItemDetailsResponse,
  useTraceItemDetails,
} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceItemDataset} from 'sentry/views/explore/types';
import {Attributes} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/span/eapSections/attributes';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

import {RequestWaterfall, type RequestWaterfallData} from './requestWaterfall';

function UptimeNodeDetailsHeader({
  node,
  organization,
  onTabScrollToNode,
  hideNodeActions,
}: {
  node: TraceTreeNode<TraceTree.UptimeCheck>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
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

export function UptimeNodeDetails(
  props: TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.UptimeCheck>>
) {
  const {node} = props;
  const location = useLocation();
  const theme = useTheme();
  const {projects} = useProjects();

  const project = projects.find(
    proj => proj.slug === (node.value.project_slug ?? node.event?.projectSlug)
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

type UptimeSpanNodeDetailsProps = TraceTreeNodeDetailsProps<
  TraceTreeNode<TraceTree.UptimeCheck>
> & {
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
    traceId: node.metadata.replayTraceSlug ?? traceId,
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

  const attrs = attributes.reduce(
    (acc, attribute) => {
      // Some attribute keys include prefixes and metadata (e.g. "tags[ai.prompt_tokens.used,number]")
      // prettifyAttributeName normalizes those
      acc[prettifyAttributeName(attribute.name)] = attribute.value;
      return acc;
    },
    {} as Record<string, string | number | boolean>
  );

  const waterfall: RequestWaterfallData = {
    dns: {
      durationUs: Number(attrs.dns_lookup_duration_us),
      startUs: Number(attrs.dns_lookup_start_us),
    },
    TcpConn: {
      durationUs: Number(attrs.tcp_connection_duration_us),
      startUs: Number(attrs.tcp_connection_start_us),
    },
    tlsHandshake: {
      durationUs: Number(attrs.tls_handshake_duration_us),
      startUs: Number(attrs.tls_handshake_start_us),
    },
    receiveResponse: {
      durationUs: Number(attrs.receive_response_duration_us),
      startUs: Number(attrs.receive_response_start_us),
    },
    sendRequest: {
      durationUs: Number(attrs.send_request_duration_us),
      startUs: Number(attrs.send_request_start_us),
    },
    firstByte: {
      durationUs: Number(attrs.time_to_first_byte_duration_us),
      startUs: Number(attrs.time_to_first_byte_start_us),
    },
  };

  return (
    <TraceDrawerComponents.DetailContainer>
      <UptimeNodeDetailsHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
        hideNodeActions={hideNodeActions}
      />
      <TraceDrawerComponents.BodyContainer>
        <RequestWaterfall data={waterfall} />
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
