import React from 'react';

import {Organization, EventAttachment} from 'app/types';
import ConfigStore from 'app/stores/configStore';
import withOrganization from 'app/utils/withOrganization';
import Role from 'app/components/acl/role';

type Props = {
  organization: Organization;
  projectId: string;
  eventId: string;
  attachment: EventAttachment;
  children: (downloadUrl: string | null) => React.ReactNode;
};

class AttachmentUrl extends React.PureComponent<Props> {
  hasAttachmentsRole() {
    const user = ConfigStore.get('user');
    if (!user) {
      return false;
    }

    if (user.isSuperuser) {
      return true;
    }

    const {availableRoles, attachmentsRole, role} = this.props.organization;
    if (!Array.isArray(availableRoles)) {
      return false;
    }

    const roleIds = availableRoles.map(r => r.id);
    const requiredIndex = roleIds.indexOf(attachmentsRole);
    const currentIndex = roleIds.indexOf(role || '');
    return currentIndex >= requiredIndex;
  }

  getDownloadUrl() {
    const {attachment, organization, eventId, projectId} = this.props;
    return `/api/0/projects/${organization.slug}/${projectId}/events/${eventId}/attachments/${attachment.id}/`;
  }

  render() {
    const {children, organization} = this.props;
    return (
      <Role role={organization.attachmentsRole}>
        {({hasRole}) => children(hasRole ? this.getDownloadUrl() : null)}
      </Role>
    );
  }
}

export default withOrganization(AttachmentUrl);
