import React from 'react';
import {Location, LocationDescriptor} from 'history';

import DropdownLink from 'app/components/dropdownLink';
import Link from 'app/components/links/link';
import Placeholder from 'app/components/placeholder';
import Tooltip from 'app/components/tooltip';
import Truncate from 'app/components/truncate';
import {t, tn} from 'app/locale';
import {OrganizationSummary, Project} from 'app/types';
import {Event} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';
import {getDuration} from 'app/utils/formatters';
import withProjects from 'app/utils/withProjects';

import {EventLite, QuickTraceQueryChildrenProps, TraceLite} from './quickTraceQuery';
import {
  DropdownItem,
  EventNode,
  MetaData,
  QuickTraceContainer,
  SectionSubtext,
  StyledIconEllipsis,
  TraceConnector,
} from './styles';
import {
  generateChildrenEventTarget,
  generateSingleEventTarget,
  generateTraceTarget,
  isTransaction,
  parseTraceLite,
} from './utils';

type Props = QuickTraceQueryChildrenProps & {
  event: Event;
  location: Location;
  organization: OrganizationSummary;
};

export default function QuickTrace({
  isLoading,
  error,
  trace,
  event,
  location,
  organization,
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
    <QuickTraceLite
      event={event}
      trace={trace}
      location={location}
      organization={organization}
    />
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

  // return (
  //   <QuickTraceContext.Consumer>
  //     {results => quickTrace(results)}
  //   </QuickTraceContext.Consumer>
  // );
}

type QuickTraceLiteProps = {
  event: Event;
  trace: TraceLite;
  location: Location;
  organization: OrganizationSummary;
  projects: Project[];
};

const QuickTraceLite = withProjects(
  ({event, trace, location, organization, projects}: QuickTraceLiteProps) => {
    // non transaction events are currently unsupported
    if (!isTransaction(event)) {
      return null;
    }

    const {root, current, children} = parseTraceLite(trace, event);
    const nodes: React.ReactNode[] = [];

    if (root) {
      nodes.push(
        <EventNodeDropdown
          key="root-node"
          organization={organization}
          projects={projects}
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

    const traceTarget = generateTraceTarget(event, organization);

    if (root && current && root.event_id !== current.parent_event_id) {
      nodes.push(
        <EventNodeDropdown
          key="ancestors-node"
          comingSoon
          organization={organization}
          projects={projects}
          location={location}
          seeMoreText={t('See trace in Discover')}
          seeMoreLink={traceTarget}
        >
          <Tooltip
            position="top"
            containerDisplayMode="inline-flex"
            title={t('View all transactions in this trace.')}
          >
            <EventNode type="white" pad="right" icon={null}>
              {t('Ancestors')}
            </EventNode>
          </Tooltip>
        </EventNodeDropdown>
      );
      nodes.push(<TraceConnector key="ancestors-connector" />);
    }

    nodes.push(
      <EventNode key="current-node" type="black">
        {t('This Event')}
      </EventNode>
    );

    if (children.length) {
      const childrenTarget = generateChildrenEventTarget(
        event,
        children,
        organization,
        projects,
        location
      );
      nodes.push(<TraceConnector key="children-connector" />);
      nodes.push(
        <EventNodeDropdown
          key="children-node"
          organization={organization}
          projects={projects}
          location={location}
          events={children.sort(
            (a, b) => b['transaction.duration'] - a['transaction.duration']
          )}
          seeMoreText={t('See %s children in Discover', children.length)}
          seeMoreLink={childrenTarget}
        >
          <Tooltip
            position="top"
            containerDisplayMode="inline-flex"
            title={tn(
              'View the child transaction of this event.',
              'View all child transactions of this event.',
              children.length
            )}
          >
            <EventNode type="white" pad="left" icon={null}>
              {tn('%s Child', '%s Children', children.length)}
            </EventNode>
          </Tooltip>
        </EventNodeDropdown>
      );

      nodes.push(<TraceConnector key="descendants-connector" />);
      nodes.push(
        <EventNodeDropdown
          key="descendants-node"
          comingSoon
          organization={organization}
          projects={projects}
          location={location}
          seeMoreText={t('See trace in Discover')}
          seeMoreLink={traceTarget}
        >
          <Tooltip
            position="top"
            containerDisplayMode="inline-flex"
            title={t('View all transactions in this trace.')}
          >
            <EventNode type="white" pad="left" icon={null}>
              <StyledIconEllipsis size="xs" />
            </EventNode>
          </Tooltip>
        </EventNodeDropdown>
      );
    }

    return <QuickTraceContainer>{nodes}</QuickTraceContainer>;
  }
);

type NodeProps = {
  location: Location;
  organization: OrganizationSummary;
  projects: Project[];
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
  projects,
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
            const target = generateSingleEventTarget(
              event,
              organization,
              projects,
              location
            );
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
