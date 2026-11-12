import {Alert} from '@sentry/scraps/alert';
import {Link} from '@sentry/scraps/link';

import {tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {EventAttachmentFilter} from 'sentry/views/issueDetails/groupEventAttachments/groupEventAttachmentsFilter';
import {makeIssueDetailsLocation} from 'sentry/views/issueDetails/issueDetailsQueryParams';
import {Tab} from 'sentry/views/issueDetails/types';

type Props = {
  groupId: string;
  orgSlug: string;
  projectSlug: string;
};

export function EventAttachmentsCrashReportsNotice({
  orgSlug,
  projectSlug,
  groupId,
}: Props) {
  const location = useLocation();
  const settingsUrl = `/settings/${orgSlug}/projects/${projectSlug}/security-and-privacy/`;
  const attachmentsUrl = makeIssueDetailsLocation({
    organization: {slug: orgSlug},
    groupId,
    tab: Tab.ATTACHMENTS,
    tabParams: {attachmentFilter: EventAttachmentFilter.CRASH_REPORTS},
    query: location.query,
  });

  return (
    <Alert.Container>
      <Alert variant="info">
        {tct(
          'Your limit of stored crash reports has been reached for this issue. [attachmentsLink: View crashes] or [settingsLink: configure limit].',
          {
            attachmentsLink: <Link to={attachmentsUrl} />,
            settingsLink: <Link to={settingsUrl} />,
          }
        )}
      </Alert>
    </Alert.Container>
  );
}
