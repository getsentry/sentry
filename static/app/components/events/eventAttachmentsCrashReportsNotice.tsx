import {Location} from 'history';

import {IconInfo} from 'sentry/icons';
import {tct} from 'sentry/locale';
import {crashReportTypes} from 'sentry/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter';

import Alert from '../alert';
import Link from '../links/link';

type Props = {
  groupId: string;
  location: Location;
  orgSlug: string;
  projectSlug: string;
};

const EventAttachmentsCrashReportsNotice = ({
  orgSlug,
  projectSlug,
  location,
  groupId,
}: Props) => {
  const settingsUrl = `/settings/${orgSlug}/projects/${projectSlug}/security-and-privacy/`;
  const attachmentsUrl = {
    pathname: `/organizations/${orgSlug}/issues/${groupId}/attachments/`,
    query: {...location.query, types: crashReportTypes},
  };

  return (
    <Alert type="info" icon={<IconInfo size="md" />}>
      {tct(
        'Your limit of stored crash reports has been reached for this issue. [attachmentsLink: View crashes] or [settingsLink: configure limit].',
        {
          attachmentsLink: <Link to={attachmentsUrl} />,
          settingsLink: <Link to={settingsUrl} />,
        }
      )}
    </Alert>
  );
};

export default EventAttachmentsCrashReportsNotice;
