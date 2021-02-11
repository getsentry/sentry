import React from 'react';
import styled from '@emotion/styled';
import {Location} from 'history';

import Placeholder from 'app/components/placeholder';
import {t, tn} from 'app/locale';
import {OrganizationSummary} from 'app/types';
import {Event} from 'app/types/event';
import {getShortEventId} from 'app/utils/events';

import QuickTraceQuery, {TraceLite} from './quickTraceQuery';
import {EventNode, MetaData, NodesContainer} from './styles';
import {isTransaction, parseTraceLite} from './utils';

type Props = {
  event: Event;
  organization: OrganizationSummary;
  location: Location;
};

export default function QuickTrace({event, organization, location}: Props) {
  // non transaction events are currently unsupported
  if (!isTransaction(event)) {
    return null;
  }

  const traceId = event.contexts?.trace?.trace_id ?? '';

  return (
    <QuickTraceQuery event={event} location={location} orgSlug={organization.slug}>
      {({isLoading, error, trace}) => {
        const body = isLoading ? (
          <Placeholder height="33px" />
        ) : error || trace === null ? (
          '\u2014'
        ) : (
          <QuickTraceLite event={event} trace={trace} />
        );

        return (
          <MetaData
            headingText={t('Quick Trace')}
            tooltipText={t('The unique ID assigned to this transaction.')}
            bodyText={body}
            subtext={t('Trace ID: %s', getShortEventId(traceId))}
          />
        );
      }}
    </QuickTraceQuery>
  );
}

type QuickTraceLiteProps = {
  event: Event;
  trace: TraceLite;
};

function QuickTraceLite({event, trace}: QuickTraceLiteProps) {
  const {root, current, children} = parseTraceLite(trace, event);
  const nodes: React.ReactNode[] = [];

  if (root) {
    nodes.push(
      <EventNode key="root" type="white">
        {t('Root')}
      </EventNode>
    );
  }

  if (root && current && root.event_id !== current.parent_event_id) {
    nodes.push(
      <EventNode key="ancestors" type="white">
        {t('Ancestors')}
      </EventNode>
    );
  }

  nodes.push(
    <EventNode key="current" type="black">
      {t('This Event')}
    </EventNode>
  );

  if (children.length) {
    nodes.push(
      <EventNode key="children" type="white">
        {tn('%s Child', '%s Children', children.length)}
      </EventNode>
    );
    nodes.push(
      <EventNode key="descendents" type="white">
        {t('Descendents')}
      </EventNode>
    );
  }

  return (
    <Container>
      <NodesContainer>{nodes}</NodesContainer>
    </Container>
  );
}

const Container = styled('div')`
  position: relative;
  height: 33px;
`;
