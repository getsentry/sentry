import {useTheme} from '@emotion/react';

import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';
import getDuration from 'sentry/utils/duration/getDuration';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {AttributesTree} from 'sentry/views/explore/components/traceItemAttributes/attributesTree';
import type {TraceItemResponseAttribute} from 'sentry/views/explore/hooks/useTraceItemDetails';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import type {TraceTreeNodeDetailsProps} from 'sentry/views/performance/newTraceDetails/traceDrawer/tabs/traceTreeNodeDetails';
import type {UptimeCheckTimingNode} from 'sentry/views/performance/newTraceDetails/traceModels/traceTreeNode/uptimeCheckTimingNode';

const UPTIME_PHASE_DESCRIPTIONS = {
  'dns.lookup.duration': t(
    "DNS Lookup. The Uptime Checker is resolving the request's IP address."
  ),
  'http.tcp_connection.duration': t(
    'Initial connection. The Uptime Checker is establishing a connection, including TCP handshakes or retries and negotiating an SSL.'
  ),
  'tls.handshake.duration': t(
    'TLS negotiation. The Uptime Checker is performing the TLS handshake to establish a secure connection.'
  ),
  'http.client.request.duration': t('Request sent. The request is being sent.'),
  'http.server.time_to_first_byte': t(
    'Waiting (TTFB). The Uptime Checker is waiting for the first byte of a response. TTFB stands for Time To First Byte. This timing includes 1 round trip of latency and the time the server took to prepare the response.'
  ),
  'http.client.response.duration': t(
    'Content Download. The Uptime Checker is receiving the response directly from the network. This value is the total amount of time spent reading the response body. Larger than expected values could indicate a slow network.'
  ),
};

export function UptimeTimingDetails(
  props: TraceTreeNodeDetailsProps<UptimeCheckTimingNode>
) {
  const {node} = props;
  const {op, description, duration, start_timestamp, end_timestamp} = node.value;

  const location = useLocation();
  const organization = useOrganization();
  const theme = useTheme();

  const phaseDescription =
    UPTIME_PHASE_DESCRIPTIONS[op as keyof typeof UPTIME_PHASE_DESCRIPTIONS];

  const attributes: TraceItemResponseAttribute[] = [
    {
      name: 'operation',
      type: 'str',
      value: op,
    },
    {
      name: 'duration',
      type: 'str',
      value: getDuration(duration, 2, true),
    },
    {
      name: 'start_timestamp',
      type: 'float',
      value: start_timestamp,
    },
    {
      name: 'end_timestamp',
      type: 'float',
      value: end_timestamp,
    },
  ];

  return (
    <TraceDrawerComponents.DetailContainer>
      <TraceDrawerComponents.HeaderContainer>
        <TraceDrawerComponents.Title>
          <TraceDrawerComponents.TitleText>
            {description || op}
          </TraceDrawerComponents.TitleText>
        </TraceDrawerComponents.Title>
      </TraceDrawerComponents.HeaderContainer>
      <TraceDrawerComponents.BodyContainer>
        <Text density="comfortable" style={{marginBottom: theme.space.xl}}>
          {phaseDescription}
        </Text>

        <AttributesTree
          attributes={attributes}
          rendererExtra={{
            location,
            organization,
            theme,
          }}
          columnCount={1}
          config={{
            disableActions: true,
            disableRichValue: true,
          }}
        />
      </TraceDrawerComponents.BodyContainer>
    </TraceDrawerComponents.DetailContainer>
  );
}
