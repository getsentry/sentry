import {memo} from 'react';

import {Role} from 'sentry/components/acl/role';
import {IssueAttachment, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  attachment: IssueAttachment;
  children: (downloadUrl: string | null) => React.ReactElement | null;
  eventId: string;
  organization: Organization;
  projectSlug: string;
};

function AttachmentUrl({
  attachment,
  organization,
  eventId,
  projectSlug,
  children,
}: Props) {
  function getDownloadUrl() {
    return `/api/0/projects/${organization.slug}/${projectSlug}/events/${eventId}/attachments/${attachment.id}/`;
  }

  return (
    <Role role={organization.attachmentsRole}>
      {({hasRole}) => children(hasRole ? getDownloadUrl() : null)}
    </Role>
  );
}

export default withOrganization(memo(AttachmentUrl));
