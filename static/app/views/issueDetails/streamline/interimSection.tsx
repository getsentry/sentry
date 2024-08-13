import {forwardRef, Fragment} from 'react';
import styled from '@emotion/styled';

import {
  EventDataSection,
  type EventDataSectionProps,
} from 'sentry/components/events/eventDataSection';
import {space} from 'sentry/styles/space';
import type {
  SectionConfig,
  SectionKey,
} from 'sentry/views/issueDetails/streamline/context';
import {FoldSection} from 'sentry/views/issueDetails/streamline/foldSection';
import {useHasStreamlinedUI} from 'sentry/views/issueDetails/utils';

interface InterimSectionProps extends EventDataSectionProps {
  isBlank?: SectionConfig['isBlank'];
}

/**
 * This section is meant to provide a shared component while the streamline UI
 * for issue details is being developed. Once GA'd, all occurances should be replaced
 * with just <FoldSection />
 */
export const InterimSection = forwardRef<HTMLElement, InterimSectionProps>(
  function InterimSection(
    {children, title, type, actions = null, isBlank, ...props}: InterimSectionProps,
    ref
  ) {
    const hasStreamlinedUI = useHasStreamlinedUI();

    return hasStreamlinedUI ? (
      <Fragment>
        <FoldSection
          config={{key: type as SectionKey, isBlank}}
          title={title}
          actions={actions}
          ref={ref}
        >
          {children}
        </FoldSection>
        <SectionDivider />
      </Fragment>
    ) : (
      <EventDataSection title={title} actions={actions} type={type} {...props}>
        {children}
      </EventDataSection>
    );
  }
);

export const SectionDivider = styled('hr')`
  border-color: ${p => p.theme.border};
  margin: ${space(1)} 0;
  &:last-child {
    display: none;
  }
`;
