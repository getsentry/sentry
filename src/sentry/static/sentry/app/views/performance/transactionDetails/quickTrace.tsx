import React from 'react';
import * as Sentry from '@sentry/react';
import {Location, LocationDescriptor} from 'history';

import DropdownLink from 'app/components/dropdownLink';
import ErrorBoundary from 'app/components/errorBoundary';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {t, tn} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import {
  EventLite,
  QuickTrace as QuickTraceType,
  QuickTraceQueryChildrenProps,
} from 'app/utils/performance/quickTrace/types';
import {isTransaction, parseQuickTrace} from 'app/utils/performance/quickTrace/utils';
import {Theme} from 'app/utils/theme';

import {
  DropdownItem,
  EventNode,
  MetaData,
  QuickTraceContainer,
  SectionSubtext,
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

export default function QuickTrace({
  event,
  location,
  organization,
  quickTrace: {isLoading, error, trace, type},
}: Props) {
  // non transaction events are currently unsupported
  if (!isTransaction(event)) {
    return null;
  }

  const traceId = event.contexts?.trace?.trace_id ?? null;
  const traceTarget = generateTraceTarget(event, organization);

  const body = isLoading ? (
    <Placeholder height="33px" />
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
          <Link to={traceTarget}>{t('Trace ID: %s', getShortEventId(traceId))}</Link>
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

function singleEventHoverText(event: EventLite) {
  return (
    <span>
      <Truncate
        value={event.transaction}
        maxLength={30}
        leftTrim
        trimRegex={/\.|\//g}
        expandable={false}
      />
      <br />
      {getDuration(
        event['transaction.duration'] / 1000,
        event['transaction.duration'] < 1000 ? 0 : 2,
        true
      )}
    </span>
  );
}

function QuickTracePills({
  event,
  quickTrace,
  location,
  organization,
}: QuickTracePillsProps) {
  // non transaction events are currently unsupported
  if (!isTransaction(event)) {
    return null;
  }

  let parsedQuickTrace;
  try {
    parsedQuickTrace = parseQuickTrace(quickTrace, event);
  } catch (error) {
    Sentry.setTag('currentEventID', event.id);
    Sentry.captureException(new Error('Current event not in quick trace'));
    return <React.Fragment>{'\u2014'}</React.Fragment>;
  }

  const {root, ancestors, parent, children, descendants} = parsedQuickTrace;

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
      />
    );
    nodes.push(<TraceConnector key="parent-connector" />);
  }

  nodes.push(
    <EventNode key="current-node" type="black">
      {t('This Event')}
    </EventNode>
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
      />
    );
  }

  return <QuickTraceContainer>{nodes}</QuickTraceContainer>;
}

type EventNodeSelectorProps = {
  location: Location;
  organization: OrganizationSummary;
  events: EventLite[];
  text: React.ReactNode;
  pad: 'left' | 'right';
  hoverText?: React.ReactNode;
  extrasTarget?: LocationDescriptor;
  numEvents?: number;
};

function EventNodeSelector({
  location,
  organization,
  events = [],
  text,
  pad,
  hoverText,
  extrasTarget,
  numEvents = 5,
}: EventNodeSelectorProps) {
  if (events.length === 1) {
    /**
     * When there is only 1 event, clicking the node should take the user directly to
     * the event without additional steps.
     */
    const target = generateSingleEventTarget(events[0], organization, location);
    return <StyledEventNode text={text} pad={pad} hoverText={hoverText} to={target} />;
  } else {
    /**
     * When there is more than 1 event, clicking the node should expand a dropdown to
     * allow the user to select which event to go to.
     */
    return (
      <DropdownLink
        caret={false}
        title={<StyledEventNode text={text} pad={pad} hoverText={hoverText} />}
        anchorRight
      >
        {events.slice(0, numEvents).map((event, i) => {
          const target = generateSingleEventTarget(event, organization, location);
          return (
            <DropdownItem key={event.event_id} to={target} first={i === 0}>
              <Truncate
                value={event.transaction}
                maxLength={35}
                leftTrim
                trimRegex={/\.|\//g}
                expandable={false}
              />
              <SectionSubtext>
                {getDuration(
                  event['transaction.duration'] / 1000,
                  event['transaction.duration'] < 1000 ? 0 : 2,
                  true
                )}
              </SectionSubtext>
            </DropdownItem>
          );
        })}
        {events.length > numEvents && hoverText && extrasTarget && (
          <DropdownItem to={extrasTarget}>{hoverText}</DropdownItem>
        )}
      </DropdownLink>
    );
  }
}

type EventNodeProps = {
  text: React.ReactNode;
  pad: 'left' | 'right';
  hoverText: React.ReactNode;
  to?: LocationDescriptor;
  type?: keyof Theme['tag'];
};

function StyledEventNode({text, hoverText, pad, to, type = 'white'}: EventNodeProps) {
  return (
    <Tooltip position="top" containerDisplayMode="inline-flex" title={hoverText}>
      <EventNode type={type} pad={pad} icon={null} to={to}>
        {text}
      </EventNode>
    </Tooltip>
  );
}
