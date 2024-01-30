import {Link} from 'react-router';
import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t} from 'sentry/locale';
import ProjectsStore from 'sentry/stores/projectsStore';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import useOrganization from 'sentry/utils/useOrganization';

import type {TimelineTransactionEvent} from './useTraceTimelineEvents';

export function TraceTimelineTooltip({
  event,
  frames,
}: {event: Event; frames: TimelineTransactionEvent[]}) {
  const organization = useOrganization();
  // TODO: should handling of current event + other events look different
  if (frames.length === 1 && frames[0].id === event.id) {
    return <YouAreHere>{t('You are here')}</YouAreHere>;
  }

  return (
    <UnstyledUnorderedList>
      <EventItemsWrapper>
        {frames.slice(0, 3).map(frame => {
          const titleSplit = frame.title.split(':');
          const project = ProjectsStore.getBySlug(frame.project);

          return (
            <EventItem
              key={frame.id}
              to={`/organizations/${organization.slug}/issues/${frame['issue.id']}/events/${frame.id}/`}
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
      {frames.length > 3 && (
        <TraceItem>
          <Link to={generateTraceTarget(event, organization)}>
            {t('View trace for %s more', frames.length - 3)}
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
