import {Component, Fragment} from 'react';
import type {Theme} from '@emotion/react';
import type {Location, LocationDescriptor} from 'history';

import DropdownLink from 'sentry/components/dropdownLink';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import type {
  ErrorDestination,
  TransactionDestination,
} from 'sentry/components/quickTrace/utils';
import {
  generateSingleErrorTarget,
  generateTraceTarget,
  isQuickTraceEvent,
} from 'sentry/components/quickTrace/utils';
import {Tooltip} from 'sentry/components/tooltip';
import {backend, frontend, mobile, serverless} from 'sentry/data/platformCategories';
import {IconFire} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getDocsPlatform} from 'sentry/utils/docs';
import getDuration from 'sentry/utils/duration/getDuration';
import localStorage from 'sentry/utils/localStorage';
import type {
  QuickTrace as QuickTraceType,
  QuickTraceEvent,
  TraceError,
  TracePerformanceIssue,
} from 'sentry/utils/performance/quickTrace/types';
import {isTraceError, parseQuickTrace} from 'sentry/utils/performance/quickTrace/utils';
import Projects from 'sentry/utils/projects';

const FRONTEND_PLATFORMS: string[] = [...frontend, ...mobile];
const BACKEND_PLATFORMS: string[] = [...backend, ...serverless];

import type {Organization} from 'sentry/types/organization';
import {generateLinkToEventInTraceView} from 'sentry/utils/discover/urls';

import {
  DropdownContainer,
  DropdownItem,
  DropdownItemSubContainer,
  DropdownMenuHeader,
  ErrorNodeContent,
  EventNode,
  ExternalDropdownLink,
  QuickTraceContainer,
  QuickTraceValue,
  SectionSubtext,
  SingleEventHoverText,
  TraceConnector,
} from './styles';

const TOOLTIP_PREFIX = {
  root: 'root',
  ancestors: 'ancestor',
  parent: 'parent',
  current: '',
  children: 'child',
  descendants: 'descendant',
};

type QuickTraceProps = Pick<
  EventNodeSelectorProps,
  'anchor' | 'errorDest' | 'transactionDest'
> & {
  event: Event;
  location: Location;
  organization: Organization;
  quickTrace: QuickTraceType;
};

export default function QuickTrace({
  event,
  quickTrace,
  location,
  organization,
  anchor,
  errorDest,
  transactionDest,
}: QuickTraceProps) {
  let parsedQuickTrace;
  const traceSlug = event.contexts?.trace?.trace_id ?? '';
  const noTrace = <Fragment>{'\u2014'}</Fragment>;
  try {
    if (quickTrace.orphanErrors && quickTrace.orphanErrors.length > 0) {
      const orphanError = quickTrace.orphanErrors.find(e => e.event_id === event.id);

      if (!orphanError) {
        return noTrace;
      }

      parsedQuickTrace = {
        current: orphanError,
      };
    } else {
      parsedQuickTrace = parseQuickTrace(quickTrace, event, organization);
    }
  } catch (error) {
    return noTrace;
  }

  const traceLength = quickTrace.trace?.length || quickTrace.orphanErrors?.length;
  const {root, ancestors, parent, children, descendants, current} = parsedQuickTrace;

  const nodes: React.ReactNode[] = [];
  const isOrphanErrorNode = traceLength === 1 && isTraceError(current);

  const currentNode = (
    <EventNodeSelector
      traceSlug={traceSlug}
      key="current-node"
      location={location}
      organization={organization}
      text={t('This Event')}
      events={[current]}
      currentEvent={event}
      anchor={anchor}
      nodeKey="current"
      errorDest={errorDest}
      isOrphanErrorNode={isOrphanErrorNode}
      transactionDest={transactionDest}
    />
  );

  if (root) {
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="root-node"
        location={location}
        organization={organization}
        events={[root]}
        currentEvent={event}
        text={t('Root')}
        anchor={anchor}
        nodeKey="root"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
    nodes.push(<TraceConnector key="root-connector" dashed={isOrphanErrorNode} />);
  }

  if (isOrphanErrorNode) {
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="root-node"
        location={location}
        organization={organization}
        events={[]}
        currentEvent={event}
        text={t('Root')}
        anchor={anchor}
        nodeKey="root"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
    nodes.push(<TraceConnector key="root-connector" dashed />);
    nodes.push(currentNode);
    return <QuickTraceContainer>{nodes}</QuickTraceContainer>;
  }

  if (ancestors?.length) {
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="ancestors-node"
        location={location}
        organization={organization}
        events={ancestors}
        currentEvent={event}
        text={tn('%s Ancestor', '%s Ancestors', ancestors.length)}
        anchor={anchor}
        nodeKey="ancestors"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
    nodes.push(<TraceConnector key="ancestors-connector" />);
  }

  if (parent) {
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="parent-node"
        location={location}
        organization={organization}
        events={[parent]}
        currentEvent={event}
        text={t('Parent')}
        anchor={anchor}
        nodeKey="parent"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
    nodes.push(<TraceConnector key="parent-connector" />);
  }

  if (traceLength === 1) {
    nodes.push(
      <Projects
        key="missing-services"
        orgId={organization.slug}
        slugs={[current.project_slug]}
      >
        {({projects}) => {
          const project = projects.find(p => p.slug === current.project_slug);
          if (project?.platform) {
            if (BACKEND_PLATFORMS.includes(project.platform as string)) {
              return (
                <Fragment>
                  <MissingServiceNode
                    anchor={anchor}
                    organization={organization}
                    platform={project.platform}
                    connectorSide="right"
                  />
                  {currentNode}
                </Fragment>
              );
            }
            if (FRONTEND_PLATFORMS.includes(project.platform as string)) {
              return (
                <Fragment>
                  {currentNode}
                  <MissingServiceNode
                    anchor={anchor}
                    organization={organization}
                    platform={project.platform}
                    connectorSide="left"
                  />
                </Fragment>
              );
            }
          }
          return currentNode;
        }}
      </Projects>
    );
  } else {
    nodes.push(currentNode);
  }

  if (children?.length) {
    nodes.push(<TraceConnector key="children-connector" />);
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="children-node"
        location={location}
        organization={organization}
        events={children}
        currentEvent={event}
        text={tn('%s Child', '%s Children', children.length)}
        anchor={anchor}
        nodeKey="children"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
  }

  if (descendants?.length) {
    nodes.push(<TraceConnector key="descendants-connector" />);
    nodes.push(
      <EventNodeSelector
        traceSlug={traceSlug}
        key="descendants-node"
        location={location}
        organization={organization}
        events={descendants}
        currentEvent={event}
        text={tn('%s Descendant', '%s Descendants', descendants.length)}
        anchor={anchor}
        nodeKey="descendants"
        errorDest={errorDest}
        transactionDest={transactionDest}
      />
    );
  }

  return <QuickTraceContainer>{nodes}</QuickTraceContainer>;
}

function handleNode(key: string, organization: Organization) {
  trackAnalytics('quick_trace.node.clicked', {
    organization: organization.id,
    node_key: key,
  });
}

function handleDropdownItem(key: string, organization: Organization, extra: boolean) {
  const eventKey = extra
    ? 'quick_trace.dropdown.clicked_extra'
    : 'quick_trace.dropdown.clicked';
  trackAnalytics(eventKey, {
    organization: organization.id,
    node_key: key,
  });
}

type EventNodeSelectorProps = {
  anchor: 'left' | 'right';
  currentEvent: Event;
  errorDest: ErrorDestination;
  events: QuickTraceEvent[];
  location: Location;
  nodeKey: keyof typeof TOOLTIP_PREFIX;
  organization: Organization;
  text: React.ReactNode;
  traceSlug: string;
  transactionDest: TransactionDestination;
  isOrphanErrorNode?: boolean;
  numEvents?: number;
};

function EventNodeSelector({
  traceSlug,
  location,
  organization,
  events = [],
  text,
  currentEvent,
  nodeKey,
  anchor,
  errorDest,
  transactionDest,
  isOrphanErrorNode,
  numEvents = 5,
}: EventNodeSelectorProps) {
  let errors: TraceError[] = events.flatMap(event => event.errors ?? []);
  let perfIssues: TracePerformanceIssue[] = events.flatMap(
    event => event.performance_issues ?? []
  );

  let type: keyof Theme['tag'] = nodeKey === 'current' ? 'black' : 'white';

  const hasErrors = errors.length > 0 || perfIssues.length > 0;

  if (hasErrors || isOrphanErrorNode) {
    type = nodeKey === 'current' ? 'error' : 'warning';
    text = (
      <ErrorNodeContent>
        <IconFire size="xs" />
        {text}
      </ErrorNodeContent>
    );

    if (isOrphanErrorNode) {
      return (
        <EventNode type={type} data-test-id="event-node">
          {text}
        </EventNode>
      );
    }
  }

  const isError = currentEvent.hasOwnProperty('groupID') && currentEvent.groupID !== null;
  // make sure to exclude the current event from the dropdown
  events = events.filter(
    event =>
      event.event_id !== currentEvent.id ||
      // if the current event is a perf issue, we don't want to filter out the matching txn
      (event.event_id === currentEvent.id && isError)
  );
  errors = errors.filter(error => error.event_id !== currentEvent.id);
  perfIssues = perfIssues.filter(
    issue =>
      issue.event_id !== currentEvent.id ||
      // if the current event is a txn, we don't want to filter out the matching perf issue
      (issue.event_id === currentEvent.id && !isError)
  );

  const totalErrors = errors.length + perfIssues.length;

  if (events.length + totalErrors === 0) {
    return (
      <EventNode type={type} data-test-id="event-node">
        {text}
      </EventNode>
    );
  }
  if (events.length + totalErrors === 1) {
    /**
     * When there is only 1 event, clicking the node should take the user directly to
     * the event without additional steps.
     */
    const hoverText = totalErrors ? (
      t('View the error for this Transaction')
    ) : (
      <SingleEventHoverText event={events[0]!} />
    );
    const target = errors.length
      ? generateSingleErrorTarget(errors[0]!, organization, location, errorDest)
      : perfIssues.length
        ? generateSingleErrorTarget(perfIssues[0]!, organization, location, errorDest)
        : generateLinkToEventInTraceView({
            traceSlug,
            eventId: events[0]!.event_id,
            projectSlug: events[0]!.project_slug,
            timestamp: events[0]!.timestamp,
            location,
            organization,
            transactionName: events[0]!.transaction,
            type: transactionDest,
          });
    return (
      <StyledEventNode
        text={text}
        hoverText={hoverText}
        to={target}
        onClick={() => handleNode(nodeKey, organization)}
        type={type}
      />
    );
  }
  /**
   * When there is more than 1 event, clicking the node should expand a dropdown to
   * allow the user to select which event to go to.
   */
  const hoverText = tct('View [eventPrefix] [eventType]', {
    eventPrefix: TOOLTIP_PREFIX[nodeKey],
    eventType:
      errors.length && events.length
        ? 'events'
        : events.length
          ? 'transactions'
          : 'errors',
  });
  return (
    <DropdownContainer>
      <DropdownLink
        caret={false}
        title={<StyledEventNode text={text} hoverText={hoverText} type={type} />}
        anchorRight={anchor === 'right'}
      >
        {totalErrors > 0 && (
          <DropdownMenuHeader first>
            {tn('Related Issue', 'Related Issues', totalErrors)}
          </DropdownMenuHeader>
        )}
        {[...errors, ...perfIssues].slice(0, numEvents).map(error => {
          const target = generateSingleErrorTarget(
            error,
            organization,
            location,
            errorDest,
            'related-issues-of-trace'
          );
          return (
            <DropdownNodeItem
              key={error.event_id}
              event={error}
              to={target}
              allowDefaultEvent
              onSelect={() => handleDropdownItem(nodeKey, organization, false)}
              organization={organization}
              anchor={anchor}
            />
          );
        })}
        {events.length > 0 && (
          <DropdownMenuHeader first={errors.length === 0}>
            {tn('Transaction', 'Transactions', events.length)}
          </DropdownMenuHeader>
        )}
        {events.slice(0, numEvents).map(event => {
          const target = generateLinkToEventInTraceView({
            traceSlug,
            timestamp: event.timestamp,
            projectSlug: event.project_slug,
            eventId: event.event_id,
            location,
            organization,
            type: transactionDest,
            transactionName: event.transaction,
          });
          return (
            <DropdownNodeItem
              key={event.event_id}
              event={event}
              to={target}
              onSelect={() => handleDropdownItem(nodeKey, organization, false)}
              allowDefaultEvent
              organization={organization}
              subtext={getDuration(
                event['transaction.duration'] / 1000,
                event['transaction.duration'] < 1000 ? 0 : 2,
                true
              )}
              anchor={anchor}
            />
          );
        })}
        {(errors.length > numEvents || events.length > numEvents) && (
          <DropdownItem
            to={generateTraceTarget(currentEvent, organization, location)}
            allowDefaultEvent
            onSelect={() => handleDropdownItem(nodeKey, organization, true)}
          >
            {t('View all events')}
          </DropdownItem>
        )}
      </DropdownLink>
    </DropdownContainer>
  );
}

type DropdownNodeProps = {
  anchor: 'left' | 'right';
  event: TraceError | QuickTraceEvent | TracePerformanceIssue;
  organization: Organization;
  allowDefaultEvent?: boolean;
  onSelect?: (eventKey: any) => void;
  subtext?: string;
  to?: LocationDescriptor;
};

function DropdownNodeItem({
  event,
  onSelect,
  to,
  allowDefaultEvent,
  organization,
  subtext,
  anchor,
}: DropdownNodeProps) {
  return (
    <DropdownItem to={to} onSelect={onSelect} allowDefaultEvent={allowDefaultEvent}>
      <DropdownItemSubContainer>
        <Projects orgId={organization.slug} slugs={[event.project_slug]}>
          {({projects}) => {
            const project = projects.find(p => p.slug === event.project_slug);
            return (
              <ProjectBadge
                disableLink
                hideName
                project={project ? project : {slug: event.project_slug}}
                avatarSize={16}
              />
            );
          }}
        </Projects>
        {isQuickTraceEvent(event) ? (
          <QuickTraceValue
            value={event.transaction}
            // expand in the opposite direction of the anchor
            expandDirection={anchor === 'left' ? 'right' : 'left'}
            maxLength={35}
            leftTrim
            trimRegex={/\.|\//g}
          />
        ) : (
          <QuickTraceValue
            value={event.title}
            // expand in the opposite direction of the anchor
            expandDirection={anchor === 'left' ? 'right' : 'left'}
            maxLength={45}
          />
        )}
      </DropdownItemSubContainer>
      {subtext && <SectionSubtext>{subtext}</SectionSubtext>}
    </DropdownItem>
  );
}

type EventNodeProps = {
  hoverText: React.ReactNode;
  text: React.ReactNode;
  onClick?: (eventKey: any) => void;
  to?: LocationDescriptor;
  type?: keyof Theme['tag'];
};

function StyledEventNode({text, hoverText, to, onClick, type = 'white'}: EventNodeProps) {
  return (
    <Tooltip position="top" containerDisplayMode="inline-flex" title={hoverText}>
      <EventNode
        data-test-id="event-node"
        type={type}
        icon={null}
        to={to}
        onClick={onClick}
      >
        {text}
      </EventNode>
    </Tooltip>
  );
}

type MissingServiceProps = Pick<QuickTraceProps, 'anchor' | 'organization'> & {
  connectorSide: 'left' | 'right';
  platform: string;
};
type MissingServiceState = {
  hideMissing: boolean;
};

const HIDE_MISSING_SERVICE_KEY = 'quick-trace:hide-missing-services';
// 30 days
const HIDE_MISSING_EXPIRES = 1000 * 60 * 60 * 24 * 30;

function readHideMissingServiceState() {
  const value = localStorage.getItem(HIDE_MISSING_SERVICE_KEY);
  if (value === null) {
    return false;
  }
  const expires = parseInt(value, 10);
  const now = new Date().getTime();
  return expires > now;
}

class MissingServiceNode extends Component<MissingServiceProps, MissingServiceState> {
  state: MissingServiceState = {
    hideMissing: readHideMissingServiceState(),
  };

  dismissMissingService = () => {
    const {organization, platform} = this.props;
    const now = new Date().getTime();
    localStorage.setItem(
      HIDE_MISSING_SERVICE_KEY,
      (now + HIDE_MISSING_EXPIRES).toString()
    );
    this.setState({hideMissing: true});
    trackAnalytics('quick_trace.missing_service.dismiss', {
      organization: organization.id,
      platform,
    });
  };

  trackExternalLink = () => {
    const {organization, platform} = this.props;
    trackAnalytics('quick_trace.missing_service.docs', {
      organization: organization.id,
      platform,
    });
  };

  render() {
    const {hideMissing} = this.state;
    const {anchor, connectorSide, platform} = this.props;
    if (hideMissing) {
      return null;
    }

    const docPlatform = getDocsPlatform(platform, true);
    const docsHref =
      docPlatform === null || docPlatform === 'javascript'
        ? 'https://docs.sentry.io/platforms/javascript/tracing/trace-propagation/'
        : `https://docs.sentry.io/platforms/${docPlatform}/tracing/trace-propagation/`;
    return (
      <Fragment>
        {connectorSide === 'left' && <TraceConnector dashed />}
        <DropdownContainer>
          <DropdownLink
            caret={false}
            title={
              <StyledEventNode
                type="white"
                hoverText={t('No services connected')}
                text="???"
              />
            }
            anchorRight={anchor === 'right'}
          >
            <DropdownItem width="small">
              <ExternalDropdownLink href={docsHref} onClick={this.trackExternalLink}>
                {t('Connect to a service')}
              </ExternalDropdownLink>
            </DropdownItem>
            <DropdownItem onSelect={this.dismissMissingService} width="small">
              {t('Dismiss')}
            </DropdownItem>
          </DropdownLink>
        </DropdownContainer>
        {connectorSide === 'right' && <TraceConnector dashed />}
      </Fragment>
    );
  }
}
