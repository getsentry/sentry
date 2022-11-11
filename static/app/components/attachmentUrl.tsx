import {memo} from 'react';

import {Role} from 'sentry/components/acl/role';
import type {IssueAttachment, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  attachment: IssueAttachment;
  children: (downloadUrl: string | null) => React.ReactElement | null;
  eventId: string;
  organization: Organization;
  projectId: string;
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
