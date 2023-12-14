import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import {Button} from 'sentry/components/button';
import DateTime from 'sentry/components/dateTime';
import ContextIcon from 'sentry/components/events/contextSummary/contextIcon';
import {generateIconName} from 'sentry/components/events/contextSummary/utils';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TimeSince from 'sentry/components/timeSince';
import {Tooltip} from 'sentry/components/tooltip';
import {backend} from 'sentry/data/platformCategories';
import {IconCopy, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {OrganizationSummary} from 'sentry/types';
import {Event, EventTransaction} from 'sentry/types/event';
import {getShortEventId} from 'sentry/utils/events';
import {getDuration} from 'sentry/utils/formatters';
import getDynamicText from 'sentry/utils/getDynamicText';
import {
  QuickTraceQueryChildrenProps,
  TraceMeta,
} from 'sentry/utils/performance/quickTrace/types';
import {isTransaction} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';
import theme from 'sentry/utils/theme';
import useCopyToClipboard from 'sentry/utils/useCopyToClipboard';
import EventCreatedTooltip from 'sentry/views/issueDetails/eventCreatedTooltip';

import QuickTraceMeta from './quickTraceMeta';
import {MetaData} from './styles';

type Props = Pick<
  React.ComponentProps<typeof QuickTraceMeta>,
  'errorDest' | 'transactionDest'
> & {
  event: Event;
  location: Location;
  meta: TraceMeta | null;
  organization: OrganizationSummary;
  projectId: string;
  quickTrace: QuickTraceQueryChildrenProps | null;
};

type State = {
  isLargeScreen: boolean;
};

/**
 * This should match the breakpoint chosen for the `EventDetailHeader` below
 */
const BREAKPOINT_MEDIA_QUERY = `(min-width: ${theme.breakpoints.large})`;

class EventMetas extends Component<Props, State> {
  state: State = {
    isLargeScreen: window.matchMedia?.(BREAKPOINT_MEDIA_QUERY)?.matches,
  };

  componentDidMount() {
    if (this.mq) {
      this.mq.addEventListener('change', this.handleMediaQueryChange);
    }
  }

  componentWillUnmount() {
    if (this.mq) {
      this.mq.removeEventListener('change', this.handleMediaQueryChange);
    }
  }

  mq = window.matchMedia?.(BREAKPOINT_MEDIA_QUERY);

  handleMediaQueryChange = (changed: MediaQueryListEvent) => {
    this.setState({
      isLargeScreen: changed.matches,
    });
  };

  render() {
    const {
      event,
      organization,
      projectId,
      location,
      quickTrace,
      meta,
      errorDest,
      transactionDest,
    } = this.props;
    const {isLargeScreen} = this.state;

    // Replay preview gets rendered as part of the breadcrumb section. We need
    // to check for presence of both to show the replay link button here.
    const hasReplay =
      organization.features.includes('session-replay') &&
      Boolean(event.entries.find(({type}) => type === 'breadcrumbs')) &&
      Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);

    const type = isTransaction(event) ? 'transaction' : 'event';

    const timestamp = (
      <TimeSince
        tooltipBody={getDynamicText({
          value: (
            <EventCreatedTooltip
              event={{
                ...event,
                dateCreated:
                  event.dateCreated ||
                  new Date((event.endTimestamp || 0) * 1000).toISOString(),
              }}
            />
          ),
          fixed: 'Event Created Tooltip',
        })}
        date={event.dateCreated || (event.endTimestamp || 0) * 1000}
      />
    );

    return (
      <Projects orgId={organization.slug} slugs={[projectId]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectId);
          const isBackendProject =
            !!project?.platform && backend.includes(project.platform as any);

          return (
            <EventDetailHeader
              type={type}
              isBackendProject={isBackendProject}
              hasReplay={hasReplay}
            >
              <MetaData
                headingText={t('Event ID')}
                tooltipText={t('The unique ID assigned to this %s.', type)}
                bodyText={<EventID event={event} />}
                subtext={
                  <ProjectBadge
                    project={project ? project : {slug: projectId}}
                    avatarSize={16}
                  />
                }
              />
              {isTransaction(event) ? (
                <MetaData
                  headingText={t('Event Duration')}
                  tooltipText={t(
                    'The time elapsed between the start and end of this transaction.'
                  )}
                  bodyText={getDuration(
                    event.endTimestamp - event.startTimestamp,
                    2,
                    true
                  )}
                  subtext={timestamp}
                />
              ) : (
                <MetaData
                  headingText={t('Created')}
                  tooltipText={t('The time at which this event was created.')}
                  bodyText={timestamp}
                  subtext={getDynamicText({
                    value: <DateTime date={event.dateCreated} />,
                    fixed: 'May 6, 2021 3:27:01 UTC',
                  })}
                />
              )}
              {isTransaction(event) && isBackendProject && (
                <MetaData
                  headingText={t('Status')}
                  tooltipText={t(
                    'The status of this transaction indicating if it succeeded or otherwise.'
                  )}
                  bodyText={getStatusBodyText(event)}
                  subtext={<HttpStatus event={event} />}
                />
              )}
              {isTransaction(event) &&
                (event.contexts.browser ? (
                  <MetaData
                    headingText={t('Browser')}
                    tooltipText={t('The browser used in this transaction.')}
                    bodyText={<BrowserDisplay event={event} />}
                    subtext={event.contexts.browser?.version}
                  />
                ) : (
                  <span />
                ))}
              {hasReplay && (
                <ReplayButtonContainer>
                  <Button href="#replay" size="sm" icon={<IconPlay />}>
                    {t('Replay')}
                  </Button>
                </ReplayButtonContainer>
              )}
              <QuickTraceContainer>
                <QuickTraceMeta
                  event={event}
                  project={project}
                  location={location}
                  quickTrace={quickTrace}
                  traceMeta={meta}
                  anchor={isLargeScreen ? 'right' : 'left'}
                  errorDest={errorDest}
                  transactionDest={transactionDest}
                />
              </QuickTraceContainer>
            </EventDetailHeader>
          );
        }}
      </Projects>
    );
  }
}

const BrowserCenter = styled('span')`
  display: flex;
  align-items: flex-start;
  gap: ${space(1)};
`;

const IconContainer = styled('div')`
  width: 20px;
  height: 20px;
  display: flex;
  flex-shrink: 0;
  align-items: center;
  justify-content: center;
  margin-top: ${space(0.25)};
`;

export function BrowserDisplay({
  event,
  showVersion = false,
}: {
  event: Event;
  showVersion?: boolean;
}) {
  const icon = generateIconName(
    event.contexts.browser?.name,
    event.contexts.browser?.version
  );
  return (
    <BrowserCenter>
      <IconContainer>
        <ContextIcon name={icon} />
      </IconContainer>
      <span>
        {event.contexts.browser?.name} {showVersion && event.contexts.browser?.version}
      </span>
    </BrowserCenter>
  );
}

type EventDetailHeaderProps = {
  hasReplay: boolean;
  isBackendProject: boolean;
  type?: 'transaction' | 'event';
};

export function getEventDetailHeaderCols({
  hasReplay,
  isBackendProject,
  type,
}: EventDetailHeaderProps): string {
  return `grid-template-columns: ${[
    'minmax(160px, 1fr)', // Event ID
    type === 'transaction' ? 'minmax(160px, 1fr)' : 'minmax(200px, 1fr)', // Duration or Created Time
    type === 'transaction' && isBackendProject && 'minmax(160px, 1fr)', // Status
    type === 'transaction' && 'minmax(160px, 1fr) ', // Browser
    hasReplay ? '5fr' : '6fr', // Replay
    hasReplay && 'minmax(325px, 1fr)', // Quick Trace
  ]
    .filter(Boolean)
    .join(' ')};`;
}

const EventDetailHeader = styled('div')<EventDetailHeaderProps>`
  display: grid;
  grid-template-columns: repeat(${p => (p.type === 'transaction' ? 3 : 2)}, 1fr);
  grid-template-rows: repeat(2, auto);
  gap: ${space(2)};
  margin-bottom: ${space(2)};

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    margin-bottom: 0;
  }

  /* This should match the breakpoint chosen for BREAKPOINT_MEDIA_QUERY above. */
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    ${p => getEventDetailHeaderCols(p)};
    grid-row-gap: 0;
  }
`;

const ReplayButtonContainer = styled('div')`
  order: 2;
  display: flex;
  justify-content: flex-end;
  align-items: flex-start;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    order: 4;
  }
`;

const QuickTraceContainer = styled('div')`
  grid-column: 1 / -2;
  order: 1;
  @media (min-width: ${p => p.theme.breakpoints.large}) {
    order: 5;
    justify-self: flex-end;
    min-width: 325px;
    grid-column: unset;
  }
`;

function EventID({event}: {event: Event}) {
  const {onClick} = useCopyToClipboard({text: event.eventID});

  return (
    <EventIDContainer onClick={onClick}>
      <Tooltip title={event.eventID} position="top">
        <EventIDWrapper>{getShortEventId(event.eventID)}</EventIDWrapper>
        <IconCopy />
      </Tooltip>
    </EventIDContainer>
  );
}

const EventIDContainer = styled('button')`
  display: flex;
  align-items: center;

  background: transparent;
  border: none;
  padding: 0;

  &:hover {
    color: ${p => p.theme.activeText};
  }
  svg {
    color: ${p => p.theme.subText};
  }
  &:hover svg {
    color: ${p => p.theme.textColor};
  }
`;

const EventIDWrapper = styled('span')`
  margin-right: ${space(1)};
`;

export function HttpStatus({event}: {event: Event}) {
  const {tags} = event;

  const emptyStatus = <Fragment>{'\u2014'}</Fragment>;

  if (!Array.isArray(tags)) {
    return emptyStatus;
  }

  const tag = tags.find(tagObject => tagObject.key === 'http.status_code');

  if (!tag) {
    return emptyStatus;
  }

  return <Fragment>HTTP {tag.value}</Fragment>;
}

export function getStatusBodyText(event: EventTransaction): string {
  return event.contexts?.trace?.status ?? '\u2014';
}

export default EventMetas;
