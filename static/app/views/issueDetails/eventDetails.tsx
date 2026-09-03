import {useCallback, useLayoutEffect, useRef} from 'react';
import styled from '@emotion/styled';
import {useResizeObserver} from '@react-aria/utils';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {Sticky} from 'sentry/components/sticky';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import {useIssueDetails} from 'sentry/views/issueDetails/context';
import {EventMissingBanner} from 'sentry/views/issueDetails/eventMissingBanner';
import {EventTitle} from 'sentry/views/issueDetails/eventTitle';
import {
  EventDetailsContent,
  type EventDetailsContentProps,
} from 'sentry/views/issueDetails/groupEventDetails/groupEventDetailsContent';
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
  const navRef = useRef<HTMLDivElement>(null);
  const {dispatch, eventNavigationHeight} = useIssueDetails();
  const {pageContentTop} = useTopOffset();
  const stickyTopOffset = Number.parseInt(pageContentTop, 10);

  const updateNavScrollMargin = useCallback(() => {
    const navHeight = navRef.current?.offsetHeight ?? 0;
    dispatch({
      type: 'UPDATE_NAV_SCROLL_MARGIN',
      margin: navHeight + stickyTopOffset + eventNavigationHeight,
    });
  }, [dispatch, eventNavigationHeight, stickyTopOffset]);

  useLayoutEffect(updateNavScrollMargin, [updateNavScrollMargin]);
  useResizeObserver({ref: navRef, onResize: updateNavScrollMargin});

  return (
    <FloatingEventNavigation topOffset={eventNavigationHeight}>
      <EventTitle event={event} group={group} ref={navRef} />
    </FloatingEventNavigation>
  );
}

const FloatingEventNavigation = styled(Sticky)`
  isolation: isolate;
  background: ${p => p.theme.tokens.background.primary};
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};

  &::before {
    content: '';
    position: absolute;
    inset: 0 calc(-1 * var(--issue-details-inset, ${p => p.theme.space['2xl']}));
    z-index: 0;
    background: ${p => p.theme.tokens.background.primary};
    border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
    opacity: 0;
    pointer-events: none;
    transition: opacity ${p => p.theme.motion.smooth.slow};
    will-change: opacity;
  }

  & > * {
    position: relative;
    z-index: 1;
  }

  &[data-stuck] {
    border-radius: 0;
    /* Content dropdowns should scroll underneath the floating event navigation. */
    z-index: ${p => p.theme.zIndex.stickyHeader};

    &::before {
      opacity: 1;
    }
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
