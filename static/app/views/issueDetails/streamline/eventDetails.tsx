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
import {
  EventDetailsContext,
  useEventDetails,
  useEventDetailsReducer,
} from 'sentry/views/issueDetails/streamline/context';
import {EventTitle} from 'sentry/views/issueDetails/streamline/eventTitle';

export function EventDetails({
  group,
  event,
  project,
}: Required<EventDetailsContentProps>) {
  const {eventDetails, dispatch} = useEventDetailsReducer();

  return (
    <EventDetailsContext.Provider value={{...eventDetails, dispatch}}>
      <PageErrorBoundary mini message={t('There was an error loading the event content')}>
        <GroupContent>
          <StickyEventNav event={event} group={group} />
          <ContentPadding>
            <EventDetailsContent group={group} event={event} project={project} />
          </ContentPadding>
        </GroupContent>
      </PageErrorBoundary>
    </EventDetailsContext.Provider>
  );
}

function StickyEventNav({event, group}: {event: Event; group: Group}) {
  const theme = useTheme();
  const [nav, setNav] = useState<HTMLDivElement | null>(null);
  const isStuck = useIsStuck(nav);
  const isScreenMedium = useMedia(`(max-width: ${theme.breakpoints.medium})`);
  const {dispatch} = useEventDetails();

  useLayoutEffect(() => {
    if (!nav) {
      return;
    }

    const navHeight = nav.offsetHeight ?? 0;
    const sidebarHeight = isScreenMedium ? theme.sidebar.mobileHeightNumber : 0;
    dispatch({
      type: 'UPDATE_DETAILS',
      state: {navScrollMargin: navHeight + sidebarHeight},
    });
  }, [nav, isScreenMedium, dispatch, theme.sidebar.mobileHeightNumber]);

  return (
    <FloatingEventNavigation
      event={event}
      group={group}
      ref={setNav}
      data-stuck={isStuck}
    />
  );
}

const FloatingEventNavigation = styled(EventTitle)`
  position: sticky;
  top: 0;
  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    top: ${p => p.theme.sidebar.mobileHeight};
  }
  background: ${p => p.theme.background};
  z-index: ${p => p.theme.zIndex.header};
  border-radius: ${p => p.theme.borderRadiusTop};

  &[data-stuck='true'] {
    border-radius: 0;
  }
`;

const ExtraContent = styled('div')`
  border: 1px solid ${p => p.theme.translucentBorder};
  background: ${p => p.theme.background};
  border-radius: ${p => p.theme.borderRadius};
`;

const GroupContent = styled(ExtraContent)`
  position: relative;
`;

const ContentPadding = styled('div')`
  padding: ${space(1)} ${space(1.5)};
`;

const PageErrorBoundary = styled(ErrorBoundary)`
  margin: 0;
  border: 1px solid ${p => p.theme.translucentBorder};
`;
