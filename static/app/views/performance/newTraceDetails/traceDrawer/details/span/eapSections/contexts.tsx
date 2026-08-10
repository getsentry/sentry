import {getOrderedContextItemsFromContexts} from 'sentry/components/events/contexts';
import {ContextCard} from 'sentry/components/events/contexts/contextCard';
import {KeyValueData} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import type {EventTransaction} from 'sentry/types/event';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  AdditionalData,
  hasAdditionalData,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/additionalData';

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
  contexts,
  extra,
  project,
}: {
  contexts: EventTransaction['contexts'] | undefined;
  extra: EventTransaction['context'] | undefined;
  project: Project | undefined;
}) {
  const extraContexts = getOrderedContextItemsFromContexts({contexts}).filter(
    ({type}) => !DUPLICATES_FROM_ATTRIBUTES.includes(type)
  );
  const eventHasExtraContexts = extraContexts.length > 0;
  const eventHasAdditionalData = hasAdditionalData(extra);

  if (!eventHasExtraContexts && !eventHasAdditionalData) {
    return null;
  }

  const extraContextCards = extraContexts.map(({alias, type, value}) => (
    <ContextCard key={alias} type={type} alias={alias} value={value} project={project} />
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
      {eventHasAdditionalData ? <AdditionalData extra={extra} /> : null}
      {eventHasExtraContexts ? (
        <KeyValueData.Container>{extraContextCards}</KeyValueData.Container>
      ) : null}
    </FoldSection>
  );
}
