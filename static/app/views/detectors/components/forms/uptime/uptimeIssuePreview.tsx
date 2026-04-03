import {t} from 'sentry/locale';
import {DetectorIssuePreview} from 'sentry/views/detectors/components/forms/common/detectorIssuePreview';
import {IssuePreviewSection} from 'sentry/views/detectors/components/forms/common/issuePreviewSection';
import {ownerToActor} from 'sentry/views/detectors/components/forms/common/ownerToActor';
import {useDetectorFormContext} from 'sentry/views/detectors/components/forms/context';

import {useUptimeDetectorFormField} from './fields';

function useUptimeIssueTitle() {
  const url = useUptimeDetectorFormField('url');

  if (!url) {
    return t('Downtime detected for ...');
  }

  const parsedUrl = URL.parse(url);
  if (!parsedUrl?.hostname) {
    return t('Downtime detected for ...');
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
        subtitle={t('Your monitored domain is down')}
        assignee={assignee}
        project={project}
      />
    </IssuePreviewSection>
  );
}
