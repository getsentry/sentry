import ErrorBoundary from 'sentry/components/errorBoundary';
import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import {CONTEXT_DOCS_LINK} from 'sentry/components/events/contextSummary/utils';
import {EventDataSection} from 'sentry/components/events/eventDataSection';
import * as KeyValueData from 'sentry/components/keyValueData/card';
import ExternalLink from 'sentry/components/links/externalLink';
import {t, tct} from 'sentry/locale';
import type {Event, Group, Project} from 'sentry/types';

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
        <KeyValueData.Group>{cards}</KeyValueData.Group>
      </ErrorBoundary>
    </EventDataSection>
  );
}
