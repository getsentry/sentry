import {useLayoutEffect, useState} from 'react';
import styled from '@emotion/styled';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {getConfigForIssueType} from 'sentry/utils/issueTypeConfig';
import {
  EventDetailsContent,
  type EventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EventMissingBanner} from 'sentry/views/issueDetails/streamline/eventMissingBanner';
import {EventTitle} from 'sentry/views/issueDetails/streamline/eventTitle';
import {useTopOffset} from 'sentry/views/navigation/useTopOffset';

export function EventDetails({group, event, project}: EventDetailsContentProps) {
  if (!event) {
    return (
      <GroupContent role="main">
        <BannerPadding>
          <EventMissingBanner />
        </BannerPadding>
      </GroupContent>
    );
  }

  const issueTypeConfig = getConfigForIssueType(group, project);

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event content')}>
      <GroupContent role="main">
        {issueTypeConfig.header.eventNavigation.enabled && (
          <StickyEventNav event={event} group={group} />
        )}
        <ContentPadding>
          <EventDetailsContent group={group} event={event} project={project} />
        </ContentPadding>
      </GroupContent>
    </PageErrorBoundary>
  );
}

function StickyEventNav({event, group}: {event: Event; group: Group}) {
  const [nav, setNav] = useState<HTMLDivElement | null>(null);
  const {dispatch} = useIssueDetails();
  const {contentTop} = useTopOffset();
  const stickyTopOffset = Number.parseInt(contentTop, 10);

  useLayoutEffect(() => {
    if (!nav) {
      return;
    }
    const navHeight = nav.offsetHeight ?? 0;
    dispatch({
      type: 'UPDATE_NAV_SCROLL_MARGIN',
      margin: navHeight + stickyTopOffset,
    });
  }, [nav, dispatch, stickyTopOffset]);

  return (
    <FloatingEventNavigation>
      <EventTitle event={event} group={group} ref={setNav} />
    </FloatingEventNavigation>
  );
}

const FloatingEventNavigation = styled(Sticky)`
  background: ${p => p.theme.tokens.background.primary};
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;

  &[data-stuck] {
    border-radius: 0;
  }
`;

const GroupContent = styled('div')`
  position: relative;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
`;

const ContentPadding = styled('div')`
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const BannerPadding = styled('div')`
  padding: 40px;
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 1px solid ${p => p.theme.tokens.border.transparent.neutral.muted};
`;
