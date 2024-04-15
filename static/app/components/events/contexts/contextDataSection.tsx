import {useRef} from 'react';
import styled from '@emotion/styled';

import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

interface ContextDataSectionProps {
  cards: React.ReactNode[];
}

function ContextDataSection({cards}: ContextDataSectionProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);
  const columns: React.ReactNode[] = [];
  const columnSize = Math.ceil(cards.length / columnCount);
  for (let i = 0; i < cards.length; i += columnSize) {
    columns.push(<CardColumn key={i}>{cards.slice(i, i + columnSize)}</CardColumn>);
  }
  return (
    <EventDataSection
      key={'context'}
      type={'context'}
      title={t('Context')}
      help={tct(
        'The structured context items attached to this event. [link:Learn more]',
        {
          link: <ExternalLink openInNewTab href={CONTEXT_DOCS_LINK} />,
        }
      )}
      isHelpHoverable
    >
      <CardWrapper columnCount={columnCount} ref={containerRef}>
        {columns}
      </CardWrapper>
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

export default ContextDataSection;
