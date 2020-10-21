import PropTypes from 'prop-types';
import * as React from 'react';

import {Organization, EventAttachment} from 'app/types';
import ConfigStore from 'app/stores/configStore';
import withOrganization from 'app/utils/withOrganization';
import SentryTypes from 'app/sentryTypes';

type Props = {
  organization: Organization;
  projectId: string;
  eventId: string;
  attachment: EventAttachment;
  children: (downloadUrl: string | null) => React.ReactNode;
};

class AttachmentUrl extends React.PureComponent<Props> {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectId: PropTypes.string.isRequired,
    eventId: PropTypes.string.isRequired,
    attachment: SentryTypes.EventAttachment.isRequired,
    children: PropTypes.func.isRequired,
  };

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
    const {children} = this.props;
    return children(this.hasAttachmentsRole() ? this.getDownloadUrl() : null);
  }
}

export default withOrganization(AttachmentUrl);
