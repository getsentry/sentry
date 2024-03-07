import BaseAvatar from 'sentry/components/avatar/baseAvatar';
import type {OrganizationSummary} from 'sentry/types';
import {explodeSlug} from 'sentry/utils';

type Props = {
  organization?: OrganizationSummary;
} & BaseAvatar['props'];

function OrganizationAvatar({organization, ...props}: Props) {
  if (!organization) {
    return null;
  }
  const slug = organization?.slug || '';
  const title = explodeSlug(slug);

  return (
    <BaseAvatar
      {...props}
      type={organization.avatar?.avatarType || 'letter_avatar'}
      uploadUrl={organization.avatar?.avatarUrl}
      letterId={slug}
      tooltip={slug}
      title={title}
    />
  );
}

export default OrganizationAvatar;
