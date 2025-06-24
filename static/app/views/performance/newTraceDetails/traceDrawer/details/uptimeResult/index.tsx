import {useMemo} from 'react';
import styled from '@emotion/styled';

import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types/organization';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import type {TraceTreeNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode';

import {GeneralInfo} from './sections/generalInfo';
import {UptimeHTTPInfo} from './sections/http';
import {TimingBreakdown} from './sections/timingBreakdown';

function UptimeResultNodeDetailHeader({
  node,
  organization,
  onTabScrollToNode,
  hideNodeActions,
}: {
  node: TraceTreeNode<TraceTree.EAPUptimeResult>;
  onTabScrollToNode: (node: TraceTreeNode<any>) => void;
  organization: Organization;
  hideNodeActions?: boolean;
}) {
  const uptimeResult = node.value;

  return (
    <TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.Title>
        <TraceDrawerComponents.LegacyTitleText>
          <TraceDrawerComponents.TitleText>
            {t('Uptime Check')}
          </TraceDrawerComponents.TitleText>
          <TraceDrawerComponents.SubtitleWithCopyButton
            subTitle={`ID: ${uptimeResult.guid}`}
            clipboardText={uptimeResult.guid}
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

interface UptimeResultDetailsProps
  extends TraceTreeNodeDetailsProps<TraceTreeNode<TraceTree.EAPUptimeResult>> {}

export function UptimeResultDetails(props: UptimeResultDetailsProps) {
  const {node, organization, onTabScrollToNode} = props;
  const uptimeResult = node.value;

  const sections = useMemo(() => {
    const baseSections = [];

    // General information section
    baseSections.push(
      <GeneralInfo key="general-info" node={node} organization={organization} />
    );

    // HTTP information section (if available)
    if (uptimeResult.http_status_code || uptimeResult.request_url) {
      baseSections.push(<UptimeHTTPInfo key="http-info" node={node} />);
    }

    // Timing breakdown section (if timing data is available)
    if (
      uptimeResult.dns_lookup_duration_us ||
      uptimeResult.tcp_connection_duration_us ||
      uptimeResult.tls_handshake_duration_us ||
      uptimeResult.time_to_first_byte_duration_us
    ) {
      baseSections.push(<TimingBreakdown key="timing-breakdown" node={node} />);
    }

    return baseSections;
  }, [node, organization, uptimeResult]);

  return (
    <TraceDrawerComponents.DetailContainer>
      <UptimeResultNodeDetailHeader
        node={node}
        organization={organization}
        onTabScrollToNode={onTabScrollToNode}
      />
      <TraceDrawerComponents.Content>{sections}</TraceDrawerComponents.Content>
    </TraceDrawerComponents.DetailContainer>
  );
}

const StatusBadge = styled('span')<{status: string}>`
  padding: ${space(0.5)} ${space(1)};
  border-radius: ${space(0.5)};
  font-size: ${p => p.theme.fontSizeSmall};
  font-weight: bold;
  text-transform: uppercase;

  ${p => {
    switch (p.status) {
      case 'success':
        return `
          background-color: ${p.theme.green100};
          color: ${p.theme.green400};
        `;
      case 'failure':
        return `
          background-color: ${p.theme.red100};
          color: ${p.theme.red400};
        `;
      case 'missed_window':
        return `
          background-color: ${p.theme.yellow100};
          color: ${p.theme.yellow400};
        `;
      default:
        return `
          background-color: ${p.theme.gray100};
          color: ${p.theme.gray400};
        `;
    }
  }}
`;

export {StatusBadge};
