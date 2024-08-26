import {forwardRef} from 'react';

import {
  EventDataSection,
  type EventDataSectionProps,
} from 'sentry/components/events/eventDataSection';
import type {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

/**
 * This section is meant to provide a shared component while the streamline UI
 * for issue details is being developed. Once GA'd, all occurances should be replaced
 * with just <FoldSection />
 */
export const InterimSection = forwardRef<HTMLElement, EventDataSectionProps>(
  function InterimSection(
    {children, title, type, actions = null, ...props}: EventDataSectionProps,
    ref
  ) {
    const hasStreamlinedUI = useHasStreamlinedUI();

    return hasStreamlinedUI ? (
      <FoldSection
        sectionKey={type as SectionKey}
        title={title}
        actions={actions}
        ref={ref}
      >
        {children}
      </FoldSection>
    ) : (
      <EventDataSection title={title} actions={actions} type={type} {...props}>
        {children}
      </EventDataSection>
    );
  }
);
