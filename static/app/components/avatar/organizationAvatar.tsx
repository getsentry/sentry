import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import {OrganizationSummary} from 'sentry/types';
import {explodeSlug} from 'sentry/utils';

type Props = {
  organization?: OrganizationSummary;
} & BaseAvatar['props'];

function OrganizationAvatar({organization, ...props}: Props) {
  if (!organization) {
    return null;
  }
  const slug = (organization && organization.slug) || '';
  const title = explodeSlug(slug);

  return (
    <BaseAvatar
      {...props}
      type={(organization.avatar && organization.avatar.avatarType) || 'letter_avatar'}
      uploadUrl={organization.avatar && organization.avatar.avatarUrl}
      letterId={slug}
      tooltip={slug}
      title={title}
    />
  );
}

export default OrganizationAvatar;
