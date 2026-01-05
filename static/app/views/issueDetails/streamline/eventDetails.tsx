import {useLayoutEffect, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useIsStuck} from 'sentry/utils/useIsStuck';
import useMedia from 'sentry/utils/useMedia';
import {
  EventDetailsContent,
  type EventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
import {useIssueDetails} from 'sentry/views/issueDetails/streamline/context';
import {EventMissingBanner} from 'sentry/views/issueDetails/streamline/eventMissingBanner';
import {EventTitle} from 'sentry/views/issueDetails/streamline/eventTitle';
import {NAV_MOBILE_TOPBAR_HEIGHT} from 'sentry/views/nav/constants';

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

  return (
    <PageErrorBoundary mini message={t('There was an error loading the event content')}>
      <GroupContent role="main">
        <StickyEventNav event={event} group={group} />
        <ContentPadding>
          <EventDetailsContent group={group} event={event} project={project} />
        </ContentPadding>
      </GroupContent>
    </PageErrorBoundary>
  );
}

function StickyEventNav({event, group}: {event: Event; group: Group}) {
  const theme = useTheme();
  const [nav, setNav] = useState<HTMLDivElement | null>(null);
  const isStuck = useIsStuck(nav);
  const isScreenMedium = useMedia(`(max-width: ${theme.breakpoints.md})`);
  const {dispatch} = useIssueDetails();
  const sidebarHeight = isScreenMedium ? NAV_MOBILE_TOPBAR_HEIGHT : 0;

  useLayoutEffect(() => {
    if (!nav) {
      return;
    }
    const navHeight = nav.offsetHeight ?? 0;
    dispatch({
      type: 'UPDATE_NAV_SCROLL_MARGIN',
      margin: navHeight + sidebarHeight,
    });
  }, [nav, isScreenMedium, dispatch, sidebarHeight]);

  return (
    <FloatingEventNavigation
      event={event}
      group={group}
      ref={setNav}
      data-stuck={isStuck}
      style={{top: sidebarHeight}}
    />
  );
}

const FloatingEventNavigation = styled(EventTitle)`
  position: sticky;
  background: ${p => p.theme.tokens.background.primary};
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;

  &[data-stuck='true'] {
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
  padding: ${space(1)} ${space(1.5)};
`;

const BannerPadding = styled('div')`
  padding: 40px;
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;
