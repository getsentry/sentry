import {memo, ReactNode} from 'react';

import Role from 'app/components/acl/role';
import {EventAttachment, Organization} from 'app/types';
import withOrganization from 'app/utils/withOrganization';

type Props = {
  organization: Organization;
  projectId: string;
  eventId: string;
  attachment: EventAttachment;
  children: (downloadUrl: string | null) => ReactNode;
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
