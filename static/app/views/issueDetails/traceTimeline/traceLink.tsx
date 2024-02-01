import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {IconChevron} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import useOrganization from 'sentry/utils/useOrganization';

import {useTraceTimelineEvents} from './useTraceTimelineEvents';

interface TraceLinkProps {
  event: Event;
}

export function TraceLink({event}: TraceLinkProps) {
  const organization = useOrganization();
  const {data} = useTraceTimelineEvents({event});
  const traceTarget = generateTraceTarget(event, organization);

  if (!event.contexts?.trace?.trace_id) {
    return null;
  }

  return (
    <StyledLink
      to={traceTarget}
      onClick={() => {
        trackAnalytics('quick_trace.trace_id.clicked', {
          organization,
          source: 'issues',
        });
      }}
    >
      <span>
        {t('View Full Trace')}
        {data.length > 0 && tn(' (%s issue)', ' (%s issues)', data.length)}
      </span>
      <IconChevron direction="right" size="xs" />
    </StyledLink>
  );
}

const StyledLink = styled(Link)`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
  line-height: 1.2;
  font-size: ${p => p.theme.fontSizeMedium};
`;
