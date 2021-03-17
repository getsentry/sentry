import React from 'react';
import * as ReactRouter from 'react-router';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

import DropdownLink from 'app/components/dropdownLink';
import ErrorBoundary from 'app/components/errorBoundary';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {IconFire} from 'app/icons';
import {t, tn} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {toTitleCase} from 'app/utils';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import {
  QuickTrace as QuickTraceType,
  QuickTraceEvent,
  QuickTraceQueryChildrenProps,
  TraceError,
} from 'app/utils/performance/quickTrace/types';
import {parseQuickTrace} from 'app/utils/performance/quickTrace/utils';
import Projects from 'app/utils/projects';
import {Theme} from 'app/utils/theme';

import {
  DropdownItem,
  DropdownItemSubContainer,
  EventNode,
  MetaData,
  QuickTraceContainer,
  SectionSubtext,
  StyledTruncate,
  TraceConnector,
} from './styles';
import {
  generateMultiEventsTarget,
  generateSingleEventTarget,
  generateTraceTarget,
} from './utils';

type Props = {
  event: Event;
  location: Location;
  organization: OrganizationSummary;
  quickTrace: QuickTraceQueryChildrenProps;
};

function handleTraceLink(organization: OrganizationSummary) {
  trackAnalyticsEvent({
    eventKey: 'quick_trace.trace_id.clicked',
    eventName: 'Quick Trace: Trace ID clicked',
    organization_id: parseInt(organization.id, 10),
  });
}

export default function QuickTrace({
  event,
  location,
  organization,
  quickTrace: {isLoading, error, trace, type},
}: Props) {
  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  const body = isLoading ? (
    <Placeholder height="27px" />
  ) : error || trace === null ? (
    '\u2014'
  ) : (
    <ErrorBoundary mini>
      <QuickTracePills
        event={event}
        quickTrace={{type, trace}}
        location={location}
        organization={organization}
      />
    </ErrorBoundary>
  );

  return (
    <MetaData
      headingText={t('Quick Trace')}
      tooltipText={t('A minified version of the full trace.')}
      bodyText={body}
      subtext={
        traceId === null ? (
          '\u2014'
        ) : (
          <Link to={traceTarget} onClick={() => handleTraceLink(organization)}>
            {t('Trace ID: %s', getShortEventId(traceId))}
          </Link>
        )
      }
    />
  );
}

type QuickTracePillsProps = {
  quickTrace: QuickTraceType;
  event: Event;
  location: Location;
  organization: OrganizationSummary;
};

function singleEventHoverText(event: QuickTraceEvent) {
  return (
    <div>
      <Truncate
        value={event.transaction}
        maxLength={30}
        leftTrim
        trimRegex={/\.|\//g}
        expandable={false}
      />
      <div>
        {getDuration(
          event['transaction.duration'] / 1000,
          event['transaction.duration'] < 1000 ? 0 : 2,
          true
        )}
      </div>
    </div>
  );
}

function QuickTracePills({
  event,
  quickTrace,
  location,
  organization,
}: QuickTracePillsProps) {
  let parsedQuickTrace;
  try {
    parsedQuickTrace = parseQuickTrace(quickTrace, event);
  } catch (error) {
    Sentry.setTag('current.event_id', event.id);
    Sentry.captureException(new Error('Current event not in quick trace'));
    return <React.Fragment>{'\u2014'}</React.Fragment>;
  }

  const {root, ancestors, parent, children, descendants, current} = parsedQuickTrace;

  const nodes: React.ReactNode[] = [];

  if (root) {
    nodes.push(
      <EventNodeSelector
        key="root-node"
        location={location}
        organization={organization}
        events={[root]}
        text={t('Root')}
        hoverText={singleEventHoverText(root)}
        pad="right"
        nodeKey="root"
      />
    );
    nodes.push(<TraceConnector key="root-connector" />);
  }

  if (ancestors?.length) {
    const ancestorHoverText =
      ancestors.length === 1
        ? singleEventHoverText(ancestors[0])
        : t('View all ancestor transactions of this event');
    nodes.push(
      <EventNodeSelector
        key="ancestors-node"
        location={location}
        organization={organization}
        events={ancestors}
        text={tn('%s Ancestor', '%s Ancestors', ancestors.length)}
        hoverText={ancestorHoverText}
        extrasTarget={generateMultiEventsTarget(
          event,
          ancestors,
          organization,
          location,
          'Ancestor'
        )}
        pad="right"
        nodeKey="ancestors"
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
        text={t('Parent')}
        hoverText={singleEventHoverText(parent)}
        pad="right"
        nodeKey="parent"
      />
    );
    nodes.push(<TraceConnector key="parent-connector" />);
  }

  nodes.push(
    <EventNodeSelector
      key="current-node"
      location={location}
      organization={organization}
      text={t('This %s', toTitleCase(event.type))}
      events={[current]}
      currentEvent={event}
      pad="left"
      nodeKey="current"
    />
  );

  if (children.length) {
    nodes.push(<TraceConnector key="children-connector" />);
    const childHoverText =
      children.length === 1
        ? singleEventHoverText(children[0])
        : t('View all child transactions of this event');
    nodes.push(
      <EventNodeSelector
        key="children-node"
        location={location}
        organization={organization}
        events={children}
        text={tn('%s Child', '%s Children', children.length)}
        hoverText={childHoverText}
        extrasTarget={generateMultiEventsTarget(
          event,
          children,
          organization,
          location,
          'Children'
        )}
        pad="left"
        nodeKey="children"
      />
    );
  }

  if (descendants?.length) {
    nodes.push(<TraceConnector key="descendants-connector" />);
    const descendantHoverText =
      descendants.length === 1
        ? singleEventHoverText(descendants[0])
        : t('View all child descendants of this event');
    nodes.push(
      <EventNodeSelector
        key="descendants-node"
        location={location}
        organization={organization}
        events={descendants}
        text={tn('%s Descendant', '%s Descendants', descendants.length)}
        hoverText={descendantHoverText}
        extrasTarget={generateMultiEventsTarget(
          event,
          descendants,
          organization,
          location,
          'Descendant'
        )}
        pad="left"
        nodeKey="descendants"
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
  target: LocationDescriptor,
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
  ReactRouter.browserHistory.push(target);
}

type EventNodeSelectorProps = {
  location: Location;
  organization: OrganizationSummary;
  events: QuickTraceEvent[];
  text: React.ReactNode;
  pad: 'left' | 'right';
  currentEvent?: Event;
  hoverText?: React.ReactNode;
  extrasTarget?: LocationDescriptor;
  numEvents?: number;
  nodeKey: string;
};

function EventNodeSelector({
  location,
  organization,
  events = [],
  text,
  pad,
  currentEvent,
  hoverText,
  extrasTarget,
  nodeKey,
  numEvents = 5,
}: EventNodeSelectorProps) {
  const errors: TraceError[] = [];
  events.forEach(e => {
    e?.errors?.forEach(error => {
      if (!currentEvent || currentEvent.id !== error.event_id) {
        errors.push({
          ...error,
          transaction: e.transaction,
        });
      }
    });
  });
  // Filter out the current event so its not in the dropdown
  events = currentEvent ? events.filter(e => e.event_id !== currentEvent.id) : events;

  let type: keyof Theme['tag'] = nodeKey === 'current' ? 'black' : 'white';
  if (errors.length > 0 || (currentEvent && currentEvent?.type !== 'transaction')) {
    type = nodeKey === 'current' ? 'error' : 'warning';
    text = (
      <div>
        <IconFire size="xs" />
        {text}
      </div>
    );
  }

  if (events.length + errors.length === 0) {
    return (
      <EventNode pad={pad} type={type}>
        {text}
      </EventNode>
    );
  } else if (events.length + errors.length === 1) {
    /**
     * When there is only 1 event, clicking the node should take the user directly to
     * the event without additional steps.
     */
    const target = generateSingleEventTarget(
      events[0] || errors[0],
      organization,
      location
    );
    return (
      <StyledEventNode
        text={text}
        pad={pad}
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
    return (
      <DropdownLink
        caret={false}
        title={
          <StyledEventNode text={text} pad={pad} hoverText={hoverText} type={type} />
        }
        anchorRight
      >
        {errors.slice(0, numEvents).map((error, i) => {
          const target = generateSingleEventTarget(error, organization, location);
          return (
            <DropdownNodeItem
              key={error.event_id}
              event={error}
              onSelect={() => handleDropdownItem(target, nodeKey, organization, false)}
              first={i === 0}
              organization={organization}
              subtext="error"
              subtextType="error"
            />
          );
        })}
        {events.slice(0, numEvents).map((event, i) => {
          const target = generateSingleEventTarget(event, organization, location);
          return (
            <DropdownNodeItem
              key={event.event_id}
              event={event}
              onSelect={() => handleDropdownItem(target, nodeKey, organization, false)}
              first={i === 0 && errors.length === 0}
              organization={organization}
              subtext={getDuration(
                event['transaction.duration'] / 1000,
                event['transaction.duration'] < 1000 ? 0 : 2,
                true
              )}
              subtextType="default"
            />
          );
        })}
        {events.length > numEvents && hoverText && extrasTarget && (
          <DropdownItem
            onSelect={() => handleDropdownItem(extrasTarget, nodeKey, organization, true)}
          >
            {hoverText}
          </DropdownItem>
        )}
      </DropdownLink>
    );
  }
}

type DropdownNodeProps = {
  event: TraceError | QuickTraceEvent;
  onSelect?: (eventKey: any) => void;
  first: boolean;
  organization: OrganizationSummary;
  subtext: string;
  subtextType: 'error' | 'default';
};

function DropdownNodeItem({
  event,
  onSelect,
  first,
  organization,
  subtext,
  subtextType,
}: DropdownNodeProps) {
  return (
    <DropdownItem onSelect={onSelect} first={first}>
      <DropdownItemSubContainer>
        <Projects orgId={organization.slug} slugs={[event.project_slug]}>
          {({projects}) => {
            const project = projects.find(p => p.slug === event.project_slug);
            return (
              <ProjectBadge
                hideName
                project={project ? project : {slug: event.project_slug}}
                avatarSize={16}
              />
            );
          }}
        </Projects>
        <StyledTruncate
          value={event.transaction}
          expandDirection="left"
          maxLength={35}
          leftTrim
          trimRegex={/\.|\//g}
        />
      </DropdownItemSubContainer>
      <SectionSubtext type={subtextType}>{subtext}</SectionSubtext>
    </DropdownItem>
  );
}

type EventNodeProps = {
  text: React.ReactNode;
  pad: 'left' | 'right';
  hoverText: React.ReactNode;
  to?: LocationDescriptor;
  onClick?: (eventKey: any) => void;
  type?: keyof Theme['tag'];
};

function StyledEventNode({
  text,
  hoverText,
  pad,
  to,
  onClick,
  type = 'white',
}: EventNodeProps) {
  return (
    <Tooltip position="top" containerDisplayMode="inline-flex" title={hoverText}>
      <EventNode type={type} pad={pad} icon={null} to={to} onClick={onClick}>
        {text}
      </EventNode>
    </Tooltip>
  );
}
