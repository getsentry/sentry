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
      <EventNodeDropdown
        key="root-node"
        organization={organization}
        location={location}
        events={[root]}
      >
        <Tooltip
          position="top"
          containerDisplayMode="inline-flex"
          title={t('View the root transaction in this trace.')}
        >
          <EventNode type="white" pad="right" icon={null}>
            {t('Root')}
          </EventNode>
        </Tooltip>
      </EventNodeDropdown>
    );
    nodes.push(<TraceConnector key="root-connector" />);
  }

  if (ancestors?.length) {
    const seeAncestorsText = tn(
      'View the ancestor transaction of this event.',
      'View all ancestor transactions of this event.',
      ancestors.length
    );
    const ancestorsTarget = generateMultiEventsTarget(
      event,
      ancestors,
      organization,
      location,
      'Ancestor'
    );
    nodes.push(
      <EventNodeDropdown
        key="ancestors-node"
        organization={organization}
        location={location}
        events={ancestors}
        seeMoreText={seeAncestorsText}
        seeMoreLink={ancestorsTarget}
      >
        <Tooltip
          position="top"
          containerDisplayMode="inline-flex"
          title={seeAncestorsText}
        >
          <EventNode type="white" pad="right" icon={null}>
            {tn('%s Ancestor', '%s Ancestors', ancestors.length)}
          </EventNode>
        </Tooltip>
      </EventNodeDropdown>
    );
    nodes.push(<TraceConnector key="ancestors-connector" />);
  }

  if (parent) {
    nodes.push(
      <EventNodeDropdown
        key="parent-node"
        organization={organization}
        location={location}
        events={[parent]}
      >
        <Tooltip
          position="top"
          containerDisplayMode="inline-flex"
          title={t('View the parent transaction in this trace.')}
        >
          <EventNode type="white" pad="right" icon={null}>
            {t('Parent')}
          </EventNode>
        </Tooltip>
      </EventNodeDropdown>
    );
    nodes.push(<TraceConnector key="parent-connector" />);
  }

  nodes.push(
    <EventNode key="current-node" type="black">
      {t('This Event')}
    </EventNode>
  );

  if (children.length) {
    const seeChildrenText = tn(
      'View the child transaction of this event.',
      'View all child transactions of this event.',
      children.length
    );
    const childrenTarget = generateMultiEventsTarget(
      event,
      children,
      organization,
      location,
      'Children'
    );
    nodes.push(<TraceConnector key="children-connector" />);
    nodes.push(
      <EventNodeDropdown
        key="children-node"
        organization={organization}
        location={location}
        events={children}
        seeMoreText={seeChildrenText}
        seeMoreLink={childrenTarget}
      >
        <Tooltip
          position="top"
          containerDisplayMode="inline-flex"
          title={seeChildrenText}
        >
          <EventNode type="white" pad="left" icon={null}>
            {tn('%s Child', '%s Children', children.length)}
          </EventNode>
        </Tooltip>
      </EventNodeDropdown>
    );
  }

  if (descendants?.length) {
    const seeDescedantsText = tn(
      'View the descendant transaction of this event.',
      'View all descendant transactions of this event.',
      descendants.length
    );
    const descendantsTarget = generateMultiEventsTarget(
      event,
      descendants,
      organization,
      location,
      'Descendant'
    );
    nodes.push(<TraceConnector key="descendants-connector" />);
    nodes.push(
      <EventNodeDropdown
        key="descendants-node"
        organization={organization}
        location={location}
        events={descendants}
        seeMoreText={seeDescedantsText}
        seeMoreLink={descendantsTarget}
      >
        <Tooltip
          position="top"
          containerDisplayMode="inline-flex"
          title={seeDescedantsText}
        >
          <EventNode type="white" pad="left" icon={null}>
            {tn('%s Descendant', '%s Descendants', descendants.length)}
          </EventNode>
        </Tooltip>
      </EventNodeDropdown>
    );
  }

  return <QuickTraceContainer>{nodes}</QuickTraceContainer>;
}

type NodeProps = {
  location: Location;
  organization: OrganizationSummary;
  children: React.ReactNode;
  events?: EventLite[];
  numEvents?: number;
  comingSoon?: boolean;
  seeMoreText?: React.ReactNode;
  seeMoreLink?: LocationDescriptor;
};

function EventNodeDropdown({
  location,
  organization,
  children,
  events = [],
  numEvents = 5,
  comingSoon = false,
  seeMoreText,
  seeMoreLink,
}: NodeProps) {
  return (
    <DropdownLink caret={false} title={children} anchorRight>
      {/* Inserts a temporary place holder until we are able to determine this list. */}
      {comingSoon && (
        <DropdownItem to={location} first>
          {t('Coming soon yo')}
        </DropdownItem>
      )}
      {events.length === 0
        ? null
        : events.slice(0, numEvents).map((event, i) => {
            const target = generateSingleEventTarget(event, organization, location);
            return (
              <DropdownItem key={event.event_id} to={target} first={i === 0}>
                <Truncate
                  value={event.transaction}
                  maxLength={20}
                  leftTrim
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
      {(comingSoon || events.length > numEvents) && seeMoreText && seeMoreLink && (
        <DropdownItem to={seeMoreLink}>{seeMoreText}</DropdownItem>
      )}
    </DropdownLink>
  );
}
