import {t} from 'sentry/locale';
import {EntryType, type EventTransaction} from 'sentry/types/event';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {TraceDrawerComponents} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/styles';
import {
  AdditionalData,
  hasAdditionalData,
} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/additionalData';
import {Request} from 'sentry/views/performance/newTraceDetails/traceDrawer/details/transaction/sections/request';

export function Contexts({event}: {event: EventTransaction | undefined}) {
  const eventHasRequestEntry = event?.entries.some(
    entry => entry.type === EntryType.REQUEST
  );
  const eventHasAdditionalData = event ? hasAdditionalData(event) : false;

  if (!event || (!eventHasRequestEntry && !eventHasAdditionalData)) {
    return null;
  }

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
    </FoldSection>
  );
}
