import ErrorBoundary from 'sentry/components/errorBoundary';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contexts/utils';
import KeyValueData from 'sentry/components/keyValueData';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';

interface ContextDataSectionProps {
  event: Event;
  group?: Group;
  project?: Project;
}

export default function ContextDataSection({
  event,
  group,
  project,
}: ContextDataSectionProps) {
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

  if (!cards.length) {
    return null;
  }

  return (
    <InterimSection
      key={'context'}
      type={SectionKey.CONTEXTS}
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
        <KeyValueData.Container>{cards}</KeyValueData.Container>
      </ErrorBoundary>
    </InterimSection>
  );
}
