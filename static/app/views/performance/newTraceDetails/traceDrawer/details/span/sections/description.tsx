import styled from '@emotion/styled';
import type {Location} from 'history';

import {Button} from 'sentry/components/button';
import SpanSummaryButton from 'sentry/components/events/interfaces/spans/spanSummaryButton';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {Organization} from 'sentry/types';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';
import {spanDetailsRouteWithQuery} from 'sentry/views/performance/transactionSummary/transactionSpans/spanDetails/utils';
import {
  Frame,
  SpanDescription as DBQueryDescription,
} from 'sentry/views/starfish/components/spanDescription';
import {ModuleName} from 'sentry/views/starfish/types';
import {resolveSpanModule} from 'sentry/views/starfish/utils/resolveSpanModule';

import {TraceDrawerComponents} from '../../styles';

export function SpanDescription({
  node,
  organization,
  location,
}: {
  location: Location;
  node: TraceTreeNode<TraceTree.Span>;
  organization: Organization;
}) {
  const span = node.value;
  const {event} = span;
  const resolvedModule: ModuleName = resolveSpanModule(
    span.sentry_tags?.op,
    span.sentry_tags?.category
  );

  if (![ModuleName.DB, ModuleName.RESOURCE].includes(resolvedModule)) {
    return null;
  }

  const actions =
    !span.op || !span.hash ? null : (
      <ButtonGroup>
        <SpanSummaryButton event={event} organization={organization} span={span} />
        <Button
          size="xs"
          to={spanDetailsRouteWithQuery({
            orgSlug: organization.slug,
            transaction: event.title,
            query: location.query,
            spanSlug: {op: span.op, group: span.hash},
            projectID: event.projectID,
          })}
        >
          {t('View Similar Spans')}
        </Button>
      </ButtonGroup>
    );

  const value =
    resolvedModule === ModuleName.DB ? (
      <SpanDescriptionWrapper>
        <DBQueryDescription
          groupId={span.sentry_tags?.group ?? ''}
          op={span.op ?? ''}
          preliminaryDescription={span.description}
        />
      </SpanDescriptionWrapper>
    ) : (
      span.description
    );

  const title =
    resolvedModule === ModuleName.DB && span.op?.startsWith('db')
      ? t('Database Query')
      : t('Resource');

  return (
    <TraceDrawerComponents.SectionCard
      items={[
        {
          key: 'description',
          subject: null,
          value,
        },
      ]}
      title={
        <TitleContainer>
          {title}
          {actions}
        </TitleContainer>
      }
    />
  );
}

const TitleContainer = styled('div')`
  display: flex;
  align-items: center;
  margin-bottom: ${space(0.5)};
  justify-content: space-between;
`;

const SpanDescriptionWrapper = styled('div')`
  ${Frame} {
    border: none;
  }
`;

const ButtonGroup = styled('div')`
  display: flex;
  gap: ${space(0.5)};
  flex-wrap: wrap;
  justify-content: flex-end;
`;
