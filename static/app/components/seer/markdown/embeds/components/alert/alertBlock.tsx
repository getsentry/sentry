import {DetectorAlertBlock} from 'sentry/components/seer/markdown/embeds/components/alert/alertTypes/detector';
import {IssueAlertBlock} from 'sentry/components/seer/markdown/embeds/components/alert/alertTypes/issue';
import type {EmbedOutput} from 'sentry/components/seer/markdown/embeds/utils';

/**
 * Dispatches on the one axis that changes how an alert is fetched and
 * rendered: whether the workflow engine models it as an automation (issue
 * alert) or a detector (metric, uptime, cron). Adding a new detector-backed
 * alert kind is a case in `detector.tsx`, not a new file here.
 */
export default function AlertBlock(props: EmbedOutput<'alert'>) {
  return props.kind === 'issue' ? (
    <IssueAlertBlock {...props} />
  ) : (
    <DetectorAlertBlock {...props} />
  );
}
