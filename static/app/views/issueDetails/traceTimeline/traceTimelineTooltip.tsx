import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {TimelineEvent} from './useTraceTimelineEvents';

export function TraceTimelineTooltip({
  event,
  timelineEvents,
}: {event: Event; timelineEvents: TimelineEvent[]}) {
  const organization = useOrganization();
  const {projects} = useProjects({
    slugs: [
      ...timelineEvents.reduce((acc, cur) => acc.add(cur.project), new Set<string>()),
    ],
    orgId: organization.slug,
  });
  // TODO: should handling of current event + other events look different
  if (timelineEvents.length === 1 && timelineEvents[0].id === event.id) {
    return <YouAreHere>{t('You are here')}</YouAreHere>;
  }

  return (
    <UnstyledUnorderedList>
      <EventItemsWrapper>
        {timelineEvents.slice(0, 3).map(timelineEvent => {
          const titleSplit = timelineEvent.title.split(':');
          const project = projects.find(p => p.slug === timelineEvent.project);

          return (
            <EventItem
              key={timelineEvent.id}
              to={`/organizations/${organization.slug}/issues/${timelineEvent['issue.id']}/events/${timelineEvent.id}/`}
            >
              <div>
                {project && <ProjectBadge project={project} avatarSize={18} hideName />}
              </div>
              <EventTitleWrapper>
                <EventTitle>{titleSplit[0]}</EventTitle>
                <EventDescription>{titleSplit.slice(1).join('')}</EventDescription>
              </EventTitleWrapper>
            </EventItem>
          );
        })}
      </EventItemsWrapper>
      {timelineEvents.length > 3 && (
        <TraceItem>
          <Link to={generateTraceTarget(event, organization)}>
            {t('View trace for %s more', timelineEvents.length - 3)}
          </Link>
        </TraceItem>
      )}
    </UnstyledUnorderedList>
  );
}

const UnstyledUnorderedList = styled('div')`
  display: flex;
  flex-direction: column;
  text-align: left;
`;

const EventItemsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(0.5)};
`;

const YouAreHere = styled('div')`
  padding: ${space(1)};
  font-weight: bold;
  text-align: center;
`;

const EventItem = styled(Link)`
  display: grid;
  grid-template-columns: max-content auto;
  color: ${p => p.theme.textColor};
  gap: ${space(1)};
  width: 100%;
  padding: ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  min-height: 44px;

  &:hover {
    background-color: ${p => p.theme.surface200};
    color: ${p => p.theme.textColor};
  }
`;

const EventTitleWrapper = styled('div')`
  width: 100%;
  overflow: hidden;
  line-height: 1.2;
`;

const EventTitle = styled('div')`
  ${p => p.theme.overflowEllipsis};
  font-weight: 600;
`;

const EventDescription = styled('div')`
  ${p => p.theme.overflowEllipsis};
`;

const TraceItem = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
