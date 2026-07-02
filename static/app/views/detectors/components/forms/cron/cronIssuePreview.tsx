import {t} from 'sentry/locale';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {IssuePreviewSection} from 'sentry/views/detectors/components/forms/common/issuePreviewSection';
import {ownerToActor} from 'sentry/views/detectors/components/forms/common/ownerToActor';
import {useDetectorFormProject} from 'sentry/views/detectors/components/forms/common/useDetectorFormProject';
import {useCronDetectorFormField} from 'sentry/views/detectors/components/forms/cron/fields';

const FALLBACK_ISSUE_TITLE = t('Cron failure: …');
const SUBTITLE = t('Your monitor is failing: A missed check-in was detected');

function useCronIssueTitle() {
  const name = useCronDetectorFormField('name');

  if (!name) {
    return FALLBACK_ISSUE_TITLE;
  }

  return t('Cron failure: %s', name);
}

export function CronIssuePreview({step}: {step?: number}) {
  const owner = useCronDetectorFormField('owner');
  const issueTitle = useCronIssueTitle();
  const assignee = ownerToActor(owner);
  const project = useDetectorFormProject();

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
