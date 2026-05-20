import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

import {ProblemSection} from './problemSection';
import {TroubleshootingSection} from './troubleshootingSection';

interface LowValueSpanIssueDetailsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function LowValueSpanIssueDetails(_props: LowValueSpanIssueDetailsProps) {
  return (
    <div>
      <ProblemSection />
      <SectionDivider orientation="horizontal" />
      <TroubleshootingSection />
    </div>
  );
}
