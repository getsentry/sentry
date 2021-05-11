import * as React from 'react';
import {Location, LocationDescriptor} from 'history';

import DropdownLink from 'app/components/dropdownLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {
  ErrorDestination,
  generateSingleErrorTarget,
  generateSingleTransactionTarget,
  generateTraceTarget,
  isQuickTraceEvent,
  TransactionDestination,
} from 'app/components/quickTrace/utils';
import Tooltip from 'app/components/tooltip';
import {backend, frontend, mobile, serverless} from 'app/data/platformCategories';
import {IconFire} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getDocsPlatform} from 'app/utils/docs';
import {getDuration} from 'app/utils/formatters';
import localStorage from 'app/utils/localStorage';
import {
  QuickTrace as QuickTraceType,
  QuickTraceEvent,
  TraceError,
} from 'app/utils/performance/quickTrace/types';
import {parseQuickTrace} from 'app/utils/performance/quickTrace/utils';
import Projects from 'app/utils/projects';
import {Theme} from 'app/utils/theme';

const FRONTEND_PLATFORMS: string[] = [...frontend, ...mobile];
const BACKEND_PLATFORMS: string[] = [...backend, ...serverless];

import {
  DropdownContainer,
  DropdownItem,
  DropdownItemSubContainer,
  DropdownMenuHeader,
  ErrorNodeContent,
  EventNode,
  ExternalDropdownLink,
  QuickTraceContainer,
  SectionSubtext,
  SingleEventHoverText,
  StyledTruncate,
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
  quickTrace: QuickTraceType;
  event: Event;
  location: Location;
  organization: OrganizationSummary;
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
  try {
    parsedQuickTrace = parseQuickTrace(quickTrace, event, organization);
  } catch (error) {
    return <React.Fragment>{'\u2014'}</React.Fragment>;
  }

  const traceLength = quickTrace.trace && quickTrace.trace.length;
  const {root, ancestors, parent, children, descendants, current} = parsedQuickTrace;

  const nodes: React.ReactNode[] = [];

  if (root) {
    nodes.push(
      <EventNodeSelector
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
    nodes.push(<TraceConnector key="root-connector" />);
  }

  if (ancestors?.length) {
    nodes.push(
      <EventNodeSelector
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

  const currentNode = (
    <EventNodeSelector
      key="current-node"
      location={location}
      organization={organization}
      text={t('This Event')}
      events={[current]}
      currentEvent={event}
      anchor={anchor}
      nodeKey="current"
      errorDest={errorDest}
      transactionDest={transactionDest}
    />
  );

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
                <React.Fragment>
                  <MissingServiceNode
                    anchor={anchor}
                    organization={organization}
                    platform={project.platform}
                    connectorSide="right"
                  />
                  {currentNode}
                </React.Fragment>
              );
            } else if (FRONTEND_PLATFORMS.includes(project.platform as string)) {
              return (
                <React.Fragment>
                  {currentNode}
                  <MissingServiceNode
                    anchor={anchor}
                    organization={organization}
                    platform={project.platform}
                    connectorSide="left"
                  />
                </React.Fragment>
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

  if (children.length) {
    nodes.push(<TraceConnector key="children-connector" />);
    nodes.push(
      <EventNodeSelector
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

function handleNode(key: string, organization: OrganizationSummary) {
  trackAnalyticsEvent({
    eventKey: 'quick_trace.node.clicked',
    eventName: 'Quick Trace: Node clicked',
    organization_id: parseInt(organization.id, 10),
    node_key: key,
  });
}

function handleDropdownItem(
  key: string,
  organization: OrganizationSummary,
  extra: boolean
) {
  trackAnalyticsEvent({
    eventKey: 'quick_trace.dropdown.clicked' + (extra ? '_extra' : ''),
    eventName: 'Quick Trace: Dropdown clicked',
    organization_id: parseInt(organization.id, 10),
    node_key: key,
  });
}

type EventNodeSelectorProps = {
  location: Location;
  organization: OrganizationSummary;
  events: QuickTraceEvent[];
  text: React.ReactNode;
  currentEvent: Event;
  numEvents?: number;
  anchor: 'left' | 'right';
  nodeKey: keyof typeof TOOLTIP_PREFIX;
  errorDest: ErrorDestination;
  transactionDest: TransactionDestination;
};

function EventNodeSelector({
  location,
  organization,
  events = [],
  text,
  currentEvent,
  nodeKey,
  anchor,
  errorDest,
  transactionDest,
  numEvents = 5,
}: EventNodeSelectorProps) {
  let errors: TraceError[] = events.flatMap(event => event.errors ?? []);

  let type: keyof Theme['tag'] = nodeKey === 'current' ? 'black' : 'white';
  if (errors.length > 0) {
    type = nodeKey === 'current' ? 'error' : 'warning';
    text = (
      <ErrorNodeContent>
        <IconFire size="xs" />
        {text}
      </ErrorNodeContent>
    );
  }

  // make sure to exclude the current event from the dropdown
  events = events.filter(event => event.event_id !== currentEvent.id);
  errors = errors.filter(error => error.event_id !== currentEvent.id);

  if (events.length + errors.length === 0) {
    return <EventNode type={type}>{text}</EventNode>;
  } else if (events.length + errors.length === 1) {
    /**
     * When there is only 1 event, clicking the node should take the user directly to
     * the event without additional steps.
     */
    const hoverText = errors.length ? (
      t('View the error for this Transaction')
    ) : (
      <SingleEventHoverText event={events[0]} />
    );
    const target = errors.length
      ? generateSingleErrorTarget(errors[0], organization, location, errorDest)
      : generateSingleTransactionTarget(
          events[0],
          organization,
          location,
          transactionDest
        );
    return (
      <StyledEventNode
        text={text}
        hoverText={hoverText}
        to={target}
        onClick={() => handleNode(nodeKey, organization)}
        type={type}
      />
    );
  } else {
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
          {errors.length > 0 && (
            <DropdownMenuHeader first>
              {tn('Related Error', 'Related Errors', errors.length)}
            </DropdownMenuHeader>
          )}
          {errors.slice(0, numEvents).map(error => {
            const target = generateSingleErrorTarget(
              error,
              organization,
              location,
              errorDest
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
            const target = generateSingleTransactionTarget(
              event,
              organization,
              location,
              transactionDest
            );
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
              to={generateTraceTarget(currentEvent, organization)}
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
}

type DropdownNodeProps = {
  event: TraceError | QuickTraceEvent;
  organization: OrganizationSummary;
  anchor: 'left' | 'right';
  allowDefaultEvent?: boolean;
  onSelect?: (eventKey: any) => void;
  to?: LocationDescriptor;
  subtext?: string;
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
          <StyledTruncate
            value={event.transaction}
            // expand in the opposite direction of the anchor
            expandDirection={anchor === 'left' ? 'right' : 'left'}
            maxLength={35}
            leftTrim
            trimRegex={/\.|\//g}
          />
        ) : (
          <StyledTruncate
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
  text: React.ReactNode;
  hoverText: React.ReactNode;
  to?: LocationDescriptor;
  onClick?: (eventKey: any) => void;
  type?: keyof Theme['tag'];
};

function StyledEventNode({text, hoverText, to, onClick, type = 'white'}: EventNodeProps) {
  return (
    <Tooltip position="top" containerDisplayMode="inline-flex" title={hoverText}>
      <EventNode type={type} icon={null} to={to} onClick={onClick}>
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

class MissingServiceNode extends React.Component<
  MissingServiceProps,
  MissingServiceState
> {
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
    trackAnalyticsEvent({
      eventKey: 'quick_trace.missing_service.dismiss',
      eventName: 'Quick Trace: Missing Service Dismissed',
      organization_id: parseInt(organization.id, 10),
      platform,
    });
  };

  trackExternalLink = () => {
    const {organization, platform} = this.props;
    trackAnalyticsEvent({
      eventKey: 'quick_trace.missing_service.docs',
      eventName: 'Quick Trace: Missing Service Clicked',
      organization_id: parseInt(organization.id, 10),
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
        ? 'https://docs.sentry.io/platforms/javascript/performance/connect-services/'
        : `https://docs.sentry.io/platforms/${docPlatform}/performance#connecting-services`;
    return (
      <React.Fragment>
        {connectorSide === 'left' && <TraceConnector />}
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
        {connectorSide === 'right' && <TraceConnector />}
      </React.Fragment>
    );
  }
}
