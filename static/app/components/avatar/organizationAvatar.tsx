import {Component} from 'react';

import BaseAvatar from 'app/components/avatar/baseAvatar';
import {OrganizationSummary} from 'app/types';
import {explodeSlug} from 'app/utils';

type Props = {
  organization?: OrganizationSummary;
} & Omit<BaseAvatar['props'], 'uploadPath' | 'uploadId'>;

class OrganizationAvatar extends Component<Props> {
  render() {
    const {organization, ...props} = this.props;
    if (!organization) {
      return null;
    }
    const slug = (organization && organization.slug) || '';
    const title = explodeSlug(slug);

    return (
      <BaseAvatar
        {...props}
        type={(organization.avatar && organization.avatar.avatarType) || 'letter_avatar'}
        uploadPath="organization-avatar"
        uploadId={organization.avatar && organization.avatar.avatarUuid}
        letterId={slug}
        tooltip={slug}
        title={title}
      />
    );
  }
}
export default OrganizationAvatar;
