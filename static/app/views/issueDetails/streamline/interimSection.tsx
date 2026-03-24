import {type EventDataSectionProps} from 'sentry/components/events/eventDataSection';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {
  FoldSection,
  type FoldSectionProps,
} from 'sentry/views/issueDetails/streamline/foldSection';

/**
 * This section is meant to provide a shared component while the streamline UI
 * for issue details is being developed. Once GA'd, all occurances should be replaced
 * with just <FoldSection />
 */
export function InterimSection({
  ref,
  children,
  title,
  type,
  actions = null,
  initialCollapse,
  preventCollapse,
  disableCollapsePersistence,
}: EventDataSectionProps &
  Pick<
    FoldSectionProps,
    'initialCollapse' | 'preventCollapse' | 'disableCollapsePersistence'
  >) {
  return (
    <FoldSection
      sectionKey={type as SectionKey}
      title={title}
      actions={actions}
      ref={ref}
      initialCollapse={initialCollapse}
      preventCollapse={preventCollapse}
      disableCollapsePersistence={disableCollapsePersistence}
    >
      {children}
    </FoldSection>
  );
}
