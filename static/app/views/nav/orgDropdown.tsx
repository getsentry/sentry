import {useCallback} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {IconAdd} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

function createOrganizationMenuItem(): MenuItemProps {
  const configFeatures = ConfigStore.get('features');
  const sentryUrl = localizeDomain(ConfigStore.get('links').sentryUrl);
  const route = '/organizations/new/';
  const canCreateOrg = ConfigStore.get('features').has('organizations:create');

  const menuItemProps: MenuItemProps = {
    key: 'create-organization',
    leadingItems: <IconAdd />,
    label: t('Create a new organization'),
  };

  if (configFeatures.has('system:multi-region')) {
    menuItemProps.externalHref = sentryUrl + route;
  } else {
    menuItemProps.to = route;
  }

  return {
    key: 'create-organization-section',
    children: [menuItemProps],
    hidden: !canCreateOrg,
  };
}

export function OrgDropdown({
  className,
  hideOrgLinks,
}: {
  className?: string;
  hideOrgLinks?: boolean;
}) {
  const theme = useTheme();

  const config = useLegacyStore(ConfigStore);
  const organization = useOrganization();

  // It's possible we do not have an org in context (e.g. RouteNotFound)
  // Otherwise, we should have the full org
  const hasOrgRead = organization.access?.includes('org:read');
  const hasMemberRead = organization.access?.includes('member:read');
  const hasTeamRead = organization.access?.includes('team:read');
  const hasBillingAccess = organization.access?.includes('org:billing');

  const {organizations} = useLegacyStore(OrganizationsStore);
  const [activeOrgs, inactiveOrgs] = partition(
    organizations,
    org => org.status.id === 'active'
  );

  const makeOrganizationMenuItem = useCallback(
    (org: Organization): MenuItemProps => ({
      key: org.id,
      label: <OrganizationBadge organization={org} />,
      textValue: org.name,
      to: resolveRoute(`/organizations/${org.slug}/issues/`, organization, org),
    }),
    [organization]
  );

  const makeInactiveOrganizationMenuItem = useCallback(
    (org: Organization): MenuItemProps => ({
      ...makeOrganizationMenuItem(org),
      trailingItems: <QuestionTooltip size="sm" title={org.status.name} />,
    }),
    [makeOrganizationMenuItem]
  );

  const {projects} = useProjects();

  const {layout} = useNavContext();
  const isMobile = layout === NavLayout.MOBILE;

  return (
    <DropdownMenu
      className={className}
      trigger={props => (
        <OrgDropdownTrigger
          borderless={!theme.isChonk}
          width={isMobile ? 32 : 48}
          aria-label={t('Toggle organization menu')}
          {...props}
        >
          <StyledOrganizationAvatar
            size={isMobile ? 24 : 36}
            round={false}
            organization={organization}
          />
        </OrgDropdownTrigger>
      )}
      position="right-start"
      minMenuWidth={200}
      items={[
        {
          key: 'organization',
          label: (
            <SectionTitleWrapper>
              <OrganizationBadge
                organization={organization}
                description={tn('%s Project', '%s Projects', projects.length)}
                avatarSize={32}
              />
            </SectionTitleWrapper>
          ),
          children: [
            {
              key: 'organization-settings',
              label: t('Organization Settings'),
              to: `/settings/${organization.slug}/`,
              hidden: !hasOrgRead || hideOrgLinks,
            },
            {
              key: 'projects',
              label: t('Projects'),
              to: makeProjectsPathname({path: '/', organization}),
              hidden: hideOrgLinks,
            },
            {
              key: 'members',
              label: t('Members'),
              to: `/settings/${organization.slug}/members/`,
              hidden: !hasMemberRead || hideOrgLinks,
            },
            {
              key: 'teams',
              label: t('Teams'),
              to: `/settings/${organization.slug}/teams/`,
              hidden: !hasTeamRead || hideOrgLinks,
            },
            {
              key: 'billing',
              label: t('Usage & Billing'),
              to: `/settings/${organization.slug}/billing/`,
              hidden: !hasBillingAccess || hideOrgLinks,
            },
            {
              key: 'switch-organization',
              label: t('Switch Organization'),
              isSubmenu: true,
              hidden: config.singleOrganization || isDemoModeActive(),
              children: [
                {
                  key: 'active-orgs',
                  children: orderBy(activeOrgs, ['name']).map(makeOrganizationMenuItem),
                },
                ...(inactiveOrgs.length === 0
                  ? []
                  : [
                      {
                        key: 'inactive-ogs',
                        children: orderBy(inactiveOrgs, ['name']).map(
                          makeInactiveOrganizationMenuItem
                        ),
                      },
                    ]),
                createOrganizationMenuItem(),
              ],
            },
          ],
        },
      ]}
    />
  );
}

const OrgDropdownTrigger = styled(Button)<{width: number}>`
  height: ${p => p.width}px;
  width: ${p => p.width}px;
  padding: 0; /* Without this the icon will be cutoff due to overflow */
`;

const StyledOrganizationAvatar = styled(OrganizationAvatar)`
  border-radius: 6px; /* Fixes background bleeding on corners */
`;

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeightNormal};
  color: ${p => p.theme.textColor};
`;
