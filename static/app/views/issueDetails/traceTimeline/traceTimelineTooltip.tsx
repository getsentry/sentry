import styled from '@emotion/styled';

import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import Link from 'sentry/components/links/link';
import {generateTraceTarget} from 'sentry/components/quickTrace/utils';
import {t, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Event} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';

import type {TimelineEvent} from './useTraceTimelineEvents';

interface TraceTimelineTooltipProps {
  event: Event;
  timelineEvents: TimelineEvent[];
}

export function TraceTimelineTooltip({event, timelineEvents}: TraceTimelineTooltipProps) {
  const organization = useOrganization();
  const location = useLocation();
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

  const filteredTimelineEvents = timelineEvents.filter(
    timelineEvent => timelineEvent.id !== event.id
  );
  const displayYouAreHere = filteredTimelineEvents.length !== timelineEvents.length;
  return (
    <UnstyledUnorderedList>
      {displayYouAreHere && <YouAreHereItem>{t('You are here')}</YouAreHereItem>}
      <EventItemsWrapper>
        {filteredTimelineEvents.slice(0, 3).map(timelineEvent => {
          const project = projects.find(p => p.slug === timelineEvent.project);
          return (
            <EventItem
              key={timelineEvent.id}
              to={{
                pathname: `/organizations/${organization.slug}/issues/${timelineEvent['issue.id']}/events/${timelineEvent.id}/`,
                query: {
                  ...location.query,
                  referrer: 'issues_trace_timeline',
                },
              }}
              onClick={() => {
                trackAnalytics('issue_details.issue_tab.trace_timeline_clicked', {
                  organization,
                  event_id: timelineEvent.id,
                  group_id: `${timelineEvent['issue.id']}`,
                });
              }}
            >
              <div>
                {project && (
                  <ProjectBadge project={project} avatarSize={18} hideName disableLink />
                )}
              </div>
              <EventTitleWrapper>
                <EventTitle>{timelineEvent.title}</EventTitle>
                <EventDescription>
                  {timelineEvent.transaction
                    ? timelineEvent.transaction
                    : 'stack.function' in timelineEvent
                      ? timelineEvent['stack.function'].at(-1)
                      : null}
                </EventDescription>
              </EventTitleWrapper>
            </EventItem>
          );
        })}
      </EventItemsWrapper>
      {filteredTimelineEvents.length > 3 && (
        <TraceItem>
          <Link to={generateTraceTarget(event, organization)}>
            {tn(
              'View %s more event',
              'View %s more events',
              filteredTimelineEvents.length - 3
            )}
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
  width: 220px;
`;

const EventItemsWrapper = styled('div')`
  display: flex;
  flex-direction: column;
  padding: ${space(0.5)};
`;

const YouAreHere = styled('div')`
  padding: ${space(1)} ${space(2)};
  text-align: center;
  font-size: ${p => p.theme.fontSizeMedium};
`;

const YouAreHereItem = styled('div')`
  padding: ${space(1)} ${space(2)};
  text-align: center;
  border-bottom: 1px solid ${p => p.theme.innerBorder};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const EventItem = styled(Link)`
  display: grid;
  grid-template-columns: max-content auto;
  color: ${p => p.theme.textColor};
  gap: ${space(1)};
  width: 100%;
  padding: ${space(1)} ${space(1)} ${space(0.5)} ${space(1)};
  border-radius: ${p => p.theme.borderRadius};
  font-size: ${p => p.theme.fontSizeSmall};

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
  direction: rtl;
`;

const TraceItem = styled('div')`
  padding: ${space(1)} ${space(1.5)};
  border-radius: ${p => p.theme.borderRadius};
  border-top: 1px solid ${p => p.theme.innerBorder};
`;
