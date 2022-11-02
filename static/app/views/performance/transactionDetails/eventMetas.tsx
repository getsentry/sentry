import {Component, Fragment} from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Button from 'sentry/components/button';
import Clipboard from 'sentry/components/clipboard';
import DateTime from 'sentry/components/dateTime';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import TimeSince from 'sentry/components/timeSince';
import Tooltip from 'sentry/components/tooltip';
import {frontend} from 'sentry/data/platformCategories';
import {IconCopy, IconPlay} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {AvatarProject, OrganizationSummary} from 'sentry/types';
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
      organization.features.includes('session-replay-ui') &&
      Boolean(event.entries.find(({type}) => type === 'breadcrumbs')) &&
      Boolean(event?.tags?.find(({key}) => key === 'replayId')?.value);

    const type = isTransaction(event) ? 'transaction' : 'event';

    const timestamp = (
      <TimeSince date={event.dateCreated || (event.endTimestamp || 0) * 1000} />
    );

    const httpStatus = <HttpStatus event={event} />;

    return (
      <Projects orgId={organization.slug} slugs={[projectId]}>
        {({projects}) => {
          const project = projects.find(p => p.slug === projectId);
          return (
            <EventDetailHeader type={type} hasReplay={hasReplay}>
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
              {isTransaction(event) && (
                <MetaData
                  headingText={t('Status')}
                  tooltipText={t(
                    'The status of this transaction indicating if it succeeded or otherwise.'
                  )}
                  bodyText={getStatusBodyText(project, event, meta)}
                  subtext={httpStatus}
                />
              )}
              {hasReplay && (
                <ReplayButtonContainer>
                  <Button href="#breadcrumbs" size="sm" icon={<IconPlay size="xs" />}>
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

type EventDetailHeaderProps = {
  hasReplay: boolean;
  type?: 'transaction' | 'event';
};

function getEventDetailHeaderCols({hasReplay, type}: EventDetailHeaderProps): string {
  if (type === 'transaction') {
    return hasReplay
      ? 'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 5fr minmax(325px, 1fr);'
      : 'grid-template-columns: minmax(160px, 1fr) minmax(160px, 1fr) minmax(160px, 1fr) 6fr;';
  }
  return hasReplay
    ? 'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 5fr minmax(325px, 1fr);'
    : 'grid-template-columns: minmax(160px, 1fr) minmax(200px, 1fr) 6fr;';
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
  return (
    <Clipboard value={event.eventID}>
      <EventIDContainer>
        <EventIDWrapper>{getShortEventId(event.eventID)}</EventIDWrapper>
        <Tooltip title={event.eventID} position="top">
          <IconCopy color="subText" />
        </Tooltip>
      </EventIDContainer>
    </Clipboard>
  );
}

const EventIDContainer = styled('div')`
  display: flex;
  align-items: center;
  cursor: pointer;
`;

const EventIDWrapper = styled('span')`
  margin-right: ${space(1)};
`;

function HttpStatus({event}: {event: Event}) {
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

/*
  TODO: Ash
  I put this in place as a temporary patch to prevent successful frontend transactions from being set as 'unknown', which is what Relay sets by default
  if there is no status set by the SDK. In the future, the possible statuses will be revised and frontend transactions should properly have a status set.
  When that change is implemented, this function can simply be replaced with:

  event.contexts?.trace?.status ?? '\u2014';
*/

function getStatusBodyText(
  project: AvatarProject | undefined,
  event: EventTransaction,
  meta: TraceMeta | null
): string {
  const isFrontendProject = frontend.some(val => val === project?.platform);

  if (
    isFrontendProject &&
    meta &&
    meta.errors === 0 &&
    event.contexts?.trace?.status === 'unknown'
  ) {
    return 'ok';
  }

  return event.contexts?.trace?.status ?? '\u2014';
}

export default EventMetas;
