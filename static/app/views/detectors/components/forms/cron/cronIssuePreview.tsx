import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {IssuePreviewSection} from 'sentry/views/detectors/components/forms/common/issuePreviewSection';
import {ownerToActor} from 'sentry/views/detectors/components/forms/common/ownerToActor';

const FALLBACK_ISSUE_TITLE = t('Cron failure: …');
const SUBTITLE = t('Your monitor is failing: A missed check-in was detected');

interface CronIssuePreviewProps {
  name: string;
  owner: string | null;
  project: Project;
  step?: number;
}

export function CronIssuePreview({step, name, owner, project}: CronIssuePreviewProps) {
  const issueTitle = name ? t('Cron failure: %s', name) : FALLBACK_ISSUE_TITLE;
  const assignee = owner ? ownerToActor(owner) : undefined;

  return (
    <IssuePreviewSection step={step}>
      <DetectorIssuePreview
        issueTitle={issueTitle}
        subtitle={SUBTITLE}
        assignee={assignee}
        project={project}
      />
    </IssuePreviewSection>
  );
}
