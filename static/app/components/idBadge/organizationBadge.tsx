import BadgeDisplayName from 'sentry/components/idBadge/badgeDisplayName';
import BaseBadge from 'sentry/components/idBadge/baseBadge';

type BaseBadgeProps = React.ComponentProps<typeof BaseBadge>;
type Organization = NonNullable<BaseBadgeProps['organization']>;

export interface OrganizationBadgeProps
  extends Partial<Omit<BaseBadgeProps, 'project' | 'organization' | 'team'>> {
  // A full organization is not used, but required to satisfy types with
  // withOrganization()
  organization: Organization;
  // If true, will use default max-width, or specify one as a string
  hideOverflow?: boolean | string;
}

function OrganizationBadge({
  hideOverflow = true,
  organization,
  ...props
}: OrganizationBadgeProps) {
  return (
    <BaseBadge
      displayName={
        <BadgeDisplayName hideOverflow={hideOverflow}>
          {organization.slug}
        </BadgeDisplayName>
      }
      organization={organization}
      {...props}
    />
  );
}

export default OrganizationBadge;
