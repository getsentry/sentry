import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {KeyValueData} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';

interface ContextDataSectionProps {
  event: Event;
  disableCollapsePersistence?: boolean;
  project?: Project;
}

export function ContextDataSection({
  event,
  project,
  disableCollapsePersistence,
}: ContextDataSectionProps) {
  const cards = getOrderedContextItems(event).map(
    ({alias, type, value: contextValue}) => (
      <ContextCard
        key={alias}
        type={type}
        alias={alias}
        value={contextValue}
        event={event}
        project={project}
      />
    )
  );

  if (!cards.length) {
    return null;
  }

  return (
    <FoldSection
      sectionKey={SectionKey.CONTEXTS}
      title={t('Contexts')}
      disableCollapsePersistence={disableCollapsePersistence}
    >
      <ErrorBoundary mini message={t('There was a problem loading event context.')}>
        <KeyValueData.Container>{cards}</KeyValueData.Container>
      </ErrorBoundary>
    </FoldSection>
  );
}
