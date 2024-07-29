import {
  EventDataSection,
  type EventDataSectionProps,
} from 'sentry/components/events/eventDataSection';
import {
  FoldSection,
  type FoldSectionKey,
} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface InterimSectionProps extends EventDataSectionProps {
  sectionKey: FoldSectionKey;
}
/**
 * This section is meant to provide a shared component while the streamline UI
 * for issue details is being developed. Once GA'd, all occurances should be replaced
 * with just <FoldSection />
 */
export function InterimSection({
  children,
  sectionKey,
  title,
  actions = null,
  ...props
}: InterimSectionProps) {
  const hasStreamlinedUI = useHasStreamlinedUI();

  return hasStreamlinedUI ? (
    <FoldSection sectionKey={sectionKey} title={title} actions={actions}>
      {children}
    </FoldSection>
  ) : (
    <EventDataSection title={title} actions={actions} {...props}>
      {children}
    </EventDataSection>
  );
}
