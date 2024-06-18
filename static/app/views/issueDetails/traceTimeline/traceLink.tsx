import styled from '@emotion/styled';

import Link from 'sentry/components/links/link';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {IconChevron} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import {TraceViewSources} from 'sentry/views/performance/newTraceDetails/traceMetadataHeader';

interface TraceLinkProps {
  event: Event;
}

export function TraceLink({event}: TraceLinkProps) {
  const organization = useOrganization();
  const location = useLocation();
  const traceTarget = generateTraceTarget(
    event,
    organization,
    {
      ...location,
      query: {
        ...location.query,
        groupId: event.groupID,
      },
    },
    TraceViewSources.ISSUE_DETAILS
  );

  if (!event.contexts?.trace?.trace_id) {
    return (
      <NoTraceAvailable>
        {t('No Trace Available')}
        <QuestionTooltip
          position="bottom"
          size="sm"
          title={t(
            'Traces help you understand if there are any issues with other services connected to this event'
          )}
        />
      </NoTraceAvailable>
    );
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
      <span>{t('View Full Trace')}</span>
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

  svg {
    margin-top: 1px;
  }
`;

const NoTraceAvailable = styled('span')`
  display: flex;
  align-items: center;
  gap: ${space(0.25)};
  line-height: 1.2;
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};

  svg {
    margin-top: 1px;
  }
`;
