import {memo} from 'react';

import {Role} from 'sentry/components/acl/role';
import {IssueAttachment, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  organization: Organization;
  projectId: string;
  eventId: string;
  attachment: IssueAttachment;
  children: (downloadUrl: string | null) => React.ReactNode;
};

function AttachmentUrl({attachment, organization, eventId, projectId, children}: Props) {
  function getDownloadUrl() {
    return `/api/0/projects/${organization.slug}/${projectId}/events/${eventId}/attachments/${attachment.id}/`;
  }

  return (
    <Role role={organization.attachmentsRole}>
      {({hasRole}) => children(hasRole ? getDownloadUrl() : null)}
    </Role>
  );
}

export default withOrganization(memo(AttachmentUrl));
