import {Fragment} from 'react';
import styled from '@emotion/styled';

import {
  EventDataSection,
  type EventDataSectionProps,
} from 'sentry/components/events/eventDataSection';
import {space} from 'sentry/styles/space';
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
    <Fragment>
      <FoldSection sectionKey={sectionKey} title={title} actions={actions}>
        {children}
      </FoldSection>
      <Divider />
    </Fragment>
  ) : (
    <EventDataSection title={title} actions={actions} {...props}>
      {children}
    </EventDataSection>
  );
}

const Divider = styled('hr')`
  border-color: ${p => p.theme.border};
  margin: ${space(1)} 0;
  &:last-child {
    display: none;
  }
`;
