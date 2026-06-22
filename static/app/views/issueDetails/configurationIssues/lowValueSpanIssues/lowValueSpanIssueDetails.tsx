import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionKey} from 'sentry/views/issueDetails/context';
import {FoldSection} from 'sentry/views/issueDetails/foldSection';

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
      <FoldSection sectionKey={SectionKey.CONFIGURATION_PROBLEM} title={t('Problem')}>
        <ProblemSection evidenceData={evidenceData} />
      </FoldSection>
      <FoldSection
        sectionKey={SectionKey.CONFIGURATION_SOLUTION}
        title={t('Troubleshooting')}
      >
        <TroubleshootingSection
          evidenceData={evidenceData}
          projectPlatform={project.platform}
        />
      </FoldSection>
    </div>
  );
}
