import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Event, Group, Project} from 'sentry/types';

interface ContextDataSectionProps {
  event: Event;
  group?: Group;
  project?: Project;
}

function ContextData({event, group, project}: ContextDataSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  const columns: React.ReactNode[] = [];

  const cards = getOrderedContextItems(event).map(
    ({alias, type, value: contextValue}) => (
      <ContextCard
        key={alias}
        type={type}
        alias={alias}
        value={contextValue}
        event={event}
        group={group}
        project={project}
      />
    )
  );

  const columnSize = Math.ceil(cards.length / columnCount);
  for (let i = 0; i < cards.length; i += columnSize) {
    columns.push(<CardColumn key={i}>{cards.slice(i, i + columnSize)}</CardColumn>);
  }
  return (
    <CardWrapper columnCount={columnCount} ref={containerRef}>
      {columns}
    </CardWrapper>
  );
}

export default function ContextDataSection(props: ContextDataSectionProps) {
  return (
    <EventDataSection
      key={'context'}
      type={'context'}
      title={t('Contexts')}
      help={tct(
        'The structured context items attached to this event. [link:Learn more]',
        {
          link: <ExternalLink openInNewTab href={CONTEXT_DOCS_LINK} />,
        }
      )}
      isHelpHoverable
    >
      <ErrorBoundary mini message={t('There was a problem loading event context.')}>
        <ContextData {...props} />
      </ErrorBoundary>
    </EventDataSection>
  );
}

const CardWrapper = styled('div')<{columnCount: number}>`
  display: grid;
  align-items: start;
  grid-template-columns: repeat(${p => p.columnCount}, 1fr);
  gap: 10px;
`;

const CardColumn = styled('div')`
  grid-column: span 1;
`;
