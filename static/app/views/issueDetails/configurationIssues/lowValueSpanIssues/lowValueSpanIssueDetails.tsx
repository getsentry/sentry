import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionDivider} from 'sentry/views/issueDetails/foldSection';

import {ProblemSection} from './problemSection';
import {TroubleshootingSection} from './troubleshootingSection';
import {getLowValueSpanEvidenceData} from './types';

interface LowValueSpanIssueDetailsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function LowValueSpanIssueDetails({
  event,
  project,
}: LowValueSpanIssueDetailsProps) {
  const evidenceData = getLowValueSpanEvidenceData(event.occurrence?.evidenceData);

  return (
    <div>
      <ProblemSection evidenceData={evidenceData} />
      <SectionDivider orientation="horizontal" />
      <TroubleshootingSection
        evidenceData={evidenceData}
        projectPlatform={project.platform}
      />
    </div>
  );
}
