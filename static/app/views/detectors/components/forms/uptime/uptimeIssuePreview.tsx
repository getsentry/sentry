import {t} from 'sentry/locale';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {IssuePreviewSection} from 'sentry/views/detectors/components/forms/common/issuePreviewSection';
import {ownerToActor} from 'sentry/views/detectors/components/forms/common/ownerToActor';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';
import {useUptimeDetectorFormField} from 'sentry/views/detectors/components/forms/uptime/fields';

const FALLBACK_ISSUE_TITLE = t('Downtime detected for …');
const SUBTITLE = t('Your monitored domain is down');

function useUptimeIssueTitle() {
  const url = useUptimeDetectorFormField('url');

  if (!url) {
    return FALLBACK_ISSUE_TITLE;
  }

  const parsedUrl = URL.parse(url);
  if (!parsedUrl?.hostname) {
    return FALLBACK_ISSUE_TITLE;
  }

  const path = parsedUrl.pathname === '/' ? '' : parsedUrl.pathname;
  const displayUrl = `${parsedUrl.hostname}${path}`.replace(/\/$/, '');

  return t('Downtime detected for %s', displayUrl);
}

export function UptimeIssuePreview({step}: {step?: number}) {
  const owner = useUptimeDetectorFormField('owner');
  const issueTitle = useUptimeIssueTitle();
  const assignee = ownerToActor(owner);
  const {project} = useDetectorFormContext();

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
