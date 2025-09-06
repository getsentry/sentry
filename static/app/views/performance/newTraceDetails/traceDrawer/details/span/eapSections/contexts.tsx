import {getOrderedContextItems} from 'sentry/components/events/contexts';
import ContextCard from 'sentry/components/events/contexts/contextCard';
import {KeyValueData} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  AdditionalData,
  hasAdditionalData,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/additionalData';
import {Request} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/request';

// List of context types that are displayed as span attributes.
// These should not be displayed in the contexts section.
const DUPLICATES_FROM_ATTRIBUTES = [
  'feedback',
  'response',
  'browser',
  'runtime',
  'os',
  'flags',
  'user',
  'profile',
  'replay',
  'device',
  'trace',
  'environment',
];

export function Contexts({
  event,
  project,
}: {
  event: EventTransaction | undefined;
  project: Project | undefined;
}) {
  if (!event) {
    return null;
  }

  const extraContexts = getOrderedContextItems(event).filter(
    ({type}) => !DUPLICATES_FROM_ATTRIBUTES.includes(type)
  );
  const eventHasExtraContexts = Object.keys(extraContexts).length > 0;

  const eventHasRequestEntry = event?.entries.some(
    entry => entry.type === EntryType.REQUEST
  );
  const eventHasAdditionalData = event ? hasAdditionalData(event) : false;

  if (!eventHasRequestEntry && !eventHasAdditionalData && !eventHasExtraContexts) {
    return null;
  }

  const extraContextCards = extraContexts.map(({alias, type, value}) => (
    <ContextCard
      key={alias}
      type={type}
      alias={alias}
      value={value}
      event={event}
      group={undefined}
      project={project}
    />
  ));

  return (
    <FoldSection
      sectionKey={SectionKey.CONTEXTS}
      title={
        <TraceDrawerComponents.SectionTitleWithQuestionTooltip
          title={t('Contexts')}
          tooltipText={t(
            "This data is not indexed and can't be queried in the Trace Explorer. For querying, attach these as attributes to your spans."
          )}
        />
      }
      disableCollapsePersistence
    >
      {eventHasRequestEntry ? <Request event={event} /> : null}
      {eventHasAdditionalData ? <AdditionalData event={event} /> : null}
      {eventHasExtraContexts ? (
        <KeyValueData.Container>{extraContextCards}</KeyValueData.Container>
      ) : null}
    </FoldSection>
  );
}
