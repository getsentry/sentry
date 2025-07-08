import type {OrganizationSummary} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

import {BaseAvatar, type BaseAvatarProps} from './baseAvatar';

interface OrganizationAvatarProps extends BaseAvatarProps {
  organization?: OrganizationSummary;
  ref?: React.Ref<HTMLSpanElement>;
}

export function OrganizationAvatar({
  ref,
  organization,
  ...props
}: OrganizationAvatarProps) {
  if (!organization) {
    // @TODO(jonasbadalic): Do we need a placeholder here?
    return null;
  }

  const slug = organization?.slug || '';
  const title = explodeSlug(slug);

  return (
    <BaseAvatar
      ref={ref}
      {...props}
      type={organization.avatar?.avatarType || 'letter_avatar'}
      uploadUrl={organization.avatar?.avatarUrl}
      letterId={slug}
      tooltip={slug}
      title={title}
    />
  );
}
