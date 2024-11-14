import {Alert} from 'sentry/components/alert';
import Link from 'sentry/components/links/link';
import {tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {EventAttachmentFilter} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsFilter';

type Props = {
  groupId: string;
  orgSlug: string;
  projectSlug: string;
};

function EventAttachmentsCrashReportsNotice({orgSlug, projectSlug, groupId}: Props) {
  const location = useLocation();
  const settingsUrl = `/settings/${orgSlug}/projects/${projectSlug}/security-and-privacy/`;
  const attachmentsUrl = {
    pathname: `/organizations/${orgSlug}/issues/${groupId}/attachments/`,
    query: {...location.query, attachmentFilter: EventAttachmentFilter.CRASH_REPORTS},
  };

  return (
    <Alert type="info" showIcon>
      {tct(
        'Your limit of stored crash reports has been reached for this issue. [attachmentsLink: View crashes] or [settingsLink: configure limit].',
        {
          attachmentsLink: <Link to={attachmentsUrl} />,
          settingsLink: <Link to={settingsUrl} />,
        }
      )}
    </Alert>
  );
}

export default EventAttachmentsCrashReportsNotice;
