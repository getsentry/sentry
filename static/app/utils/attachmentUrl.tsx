import {memo} from 'react';

import {Role} from 'sentry/components/acl/role';
import {IssueAttachment, Organization} from 'sentry/types';
import withOrganization from 'sentry/utils/withOrganization';

type Props = {
  attachment: IssueAttachment;
  children: (downloadUrl: string | null) => React.ReactElement | null;
  eventId: string;
  organization: Organization;
  projectId: string;
};

function getDownloadUrl(
  organization: Organization,
  projectId: Props['projectId'],
  eventId: Props['eventId'],
  attachment: IssueAttachment
) {
  return `/api/0/projects/${organization.slug}/${projectId}/events/${eventId}/attachments/${attachment.id}/`;
}

function AttachmentUrl({attachment, organization, eventId, projectId, children}: Props) {
  return (
    <Role role={organization.attachmentsRole}>
      {({hasRole}) =>
        children(
          hasRole ? getDownloadUrl(organization, projectId, eventId, attachment) : null
        )
      }
    </Role>
  );
}

export default withOrganization(memo(AttachmentUrl));
