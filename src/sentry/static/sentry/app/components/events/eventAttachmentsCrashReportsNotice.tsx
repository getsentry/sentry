import {Location} from 'history';

import {tct} from 'app/locale';
import {IconInfo} from 'app/icons';
import {crashReportTypes} from 'app/views/organizationGroupDetails/groupEventAttachments/groupEventAttachmentsFilter';

import Alert from '../alert';
import Link from '../links/link';

type Props = {
  orgSlug: string;
  projectSlug: string;
  location: Location;
  groupId: string;
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
          attachmentsLink: <Link to={attachmentsUrl} data-test-id="attachmentsLink" />,
          settingsLink: <Link to={settingsUrl} data-test-id="settingsLink" />,
        }
      )}
    </Alert>
  );
};

export default EventAttachmentsCrashReportsNotice;
