import PropTypes from 'prop-types';
import React from 'react';

import SentryTypes from 'app/sentryTypes';
import ConfigStore from 'app/stores/configStore';
import MemberListStore from 'app/stores/memberListStore';
import withOrganization from 'app/utils/withOrganization';

class AttachmentUrl extends React.PureComponent {
  static propTypes = {
    organization: SentryTypes.Organization.isRequired,
    projectId: PropTypes.string.isRequired,
    event: SentryTypes.Event.isRequired,
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

    const {availableRoles, attachmentsRole} = this.props.organization;
    if (!Array.isArray(availableRoles)) {
      return false;
    }

    const member = MemberListStore.getById(user.id);
    const currentRole = member && member.role;

    const roleIds = availableRoles.map(role => role.id);
    const requiredIndex = roleIds.indexOf(attachmentsRole);
    const currentIndex = roleIds.indexOf(currentRole);
    return currentIndex >= requiredIndex;
  }

  getDownloadUrl(attachment) {
    const {organization, event, projectId} = this.props;
    return `/api/0/projects/${organization.slug}/${projectId}/events/${
      event.id
    }/attachments/${attachment.id}/?download=1`;
  }

  render() {
    const {attachment, children} = this.props;
    return children(this.hasAttachmentsRole() ? this.getDownloadUrl(attachment) : null);
  }
}

export default withOrganization(AttachmentUrl);
