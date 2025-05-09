import {BaseAvatar, type BaseAvatarProps} from 'sentry/components/core/avatar/baseAvatar';
import type {OrganizationSummary} from 'sentry/types/organization';
import {explodeSlug} from 'sentry/utils';

export interface OrganizationAvatarProps extends BaseAvatarProps {
  organization?: OrganizationSummary;
}

export function OrganizationAvatar({
  ref,
  organization,
  ...props
}: OrganizationAvatarProps & {
  ref?: React.Ref<HTMLSpanElement>;
}) {
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
