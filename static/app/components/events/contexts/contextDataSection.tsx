import styled from '@emotion/styled';

import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';

interface ContextDataSectionProps {
  cards: React.ReactNode[];
}

function ContextDataSection({cards}: ContextDataSectionProps) {
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
    >
      <CardWrapper>
        <CardColumn>{cards}</CardColumn>
      </CardWrapper>
    </EventDataSection>
  );
}

const CardWrapper = styled('div')`
  display: grid;
  grid-template-columns: 1fr 1fr;
  align-items: start;
  gap: 10px;
`;

const CardColumn = styled('div')`
  grid-column: span 1;
`;

export default ContextDataSection;
