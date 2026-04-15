import {useSourceMapDebugQuery} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';
import {
  getSourceMapsDocLinks,
  projectPlatformToDocsMap,
} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import type {Event} from 'sentry/types/event';
import type {Group} from 'sentry/types/group';
import type {Project} from 'sentry/types/project';
import {SectionDivider} from 'sentry/views/issueDetails/streamline/foldSection';

import {DiagnosisSection} from './diagnosisSection';
import {ImpactSection} from './impactSection';
import {ProblemSection} from './problemSection';
import {TroubleshootingSection} from './troubleshootingSection';

interface SourceMapIssueDetailsProps {
  event: Event;
  group: Group;
  project: Project;
}

export function SourceMapIssueDetails({event, project}: SourceMapIssueDetailsProps) {
  const sourceMapQuery = useSourceMapDebugQuery(
    project.slug,
    event.occurrence?.evidenceData?.sampleEventId,
    event.sdk?.name ?? null
  );

  const docsSegment =
    (project.platform && projectPlatformToDocsMap[project.platform]) ?? 'javascript';
  const docLinks = getSourceMapsDocLinks(docsSegment);

  return (
    <div>
      <ProblemSection sourcemapsDocsUrl={docLinks.sourcemaps} />
      <SectionDivider orientation="horizontal" />
      <DiagnosisSection sourceMapQuery={sourceMapQuery} />
      <SectionDivider orientation="horizontal" />
      <TroubleshootingSection sourcemapsDocsUrl={docLinks.sourcemaps} project={project} />
      <SectionDivider orientation="horizontal" />
      <ImpactSection project={project} />
    </div>
  );
}
