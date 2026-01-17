import styled from '@emotion/styled';
import orderBy from 'lodash/orderBy';
import partition from 'lodash/partition';

import {OrganizationAvatar} from 'sentry/components/core/avatar/organizationAvatar';
import {Button} from 'sentry/components/core/button';
import {DropdownMenu, type MenuItemProps} from 'sentry/components/dropdownMenu';
import OrganizationBadge from 'sentry/components/idBadge/organizationBadge';
import QuestionTooltip from 'sentry/components/questionTooltip';
import {CUSTOM_REFERRER_KEY} from 'sentry/constants';
import {IconAdd} from 'sentry/icons';
import {t, tn} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import OrganizationsStore from 'sentry/stores/organizationsStore';
import {useLegacyStore} from 'sentry/stores/useLegacyStore';
import type {Organization} from 'sentry/types/organization';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {localizeDomain, resolveRoute} from 'sentry/utils/resolveRoute';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {useSessionStorage} from 'sentry/utils/useSessionStorage';
import {useNavContext} from 'sentry/views/nav/context';
import {NavLayout} from 'sentry/views/nav/types';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

interface OrganizationDropdownProps {
  /**
   * When true, hides settings, projects, members, teams, and billing links for the current organization.
   */
  hideCurrentOrganizationLinks?: boolean;
  onClick?: () => void;
}

export function OrganizationDropdown(props: OrganizationDropdownProps) {
  const navigate = useNavigate();
  const config = useLegacyStore(ConfigStore);

  const organization = useOrganization();
  const {organizations} = useLegacyStore(OrganizationsStore);

  const [activeOrgs, inactiveOrgs] = partition(
    organizations.filter(org => org.slug !== organization.slug),
    org => org.status.id === 'active'
  );

  const {projects} = useProjects();
  const {layout} = useNavContext();

  const [, setReferrer] = useSessionStorage<string | null>(CUSTOM_REFERRER_KEY, null);

  return (
    <DropdownMenu
      trigger={triggerProps => (
        <OrganizationDropdownTrigger
          layout={layout}
          size="xs"
          aria-label={t('Toggle organization menu')}
          {...triggerProps}
          onClick={e => {
            triggerProps.onClick?.(e);
            props.onClick?.();
          }}
        >
          <OrganizationAvatar
            organization={organization}
            size={layout === NavLayout.MOBILE ? 24 : 36}
          />
        </OrganizationDropdownTrigger>
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
            ...(props.hideCurrentOrganizationLinks
              ? []
              : [
                  {
                    key: 'organization-settings',
                    label: t('Organization Settings'),
                    to: `/settings/${organization.slug}/`,
                    hidden: !organization.access?.includes('org:read'),
                  },
                  {
                    key: 'projects',
                    label: t('Projects'),
                    onAction: () => {
                      setReferrer('org-dropdown');
                      navigate(makeProjectsPathname({path: '/', organization}));
                    },
                  },
                  {
                    key: 'members',
                    label: t('Members'),
                    to: `/settings/${organization.slug}/members/`,
                    hidden: !organization.access?.includes('member:read'),
                  },
                  {
                    key: 'teams',
                    label: t('Teams'),
                    to: `/settings/${organization.slug}/teams/`,
                    hidden: !organization.access?.includes('team:read'),
                  },
                  {
                    key: 'billing',
                    label: t('Usage & Billing'),
                    to: `/settings/${organization.slug}/billing/`,
                    hidden: !organization.access?.includes('org:billing'),
                  },
                ]),
            {
              key: 'switch-organization',
              label: t('Switch Organization'),
              isSubmenu: true,
              hidden: config.singleOrganization || isDemoModeActive(),
              children: [
                {
                  key: 'active-orgs',
                  children: orderBy(activeOrgs, ['name']).map(makeOrganizationMenuItem),
                  // Hide entire submenu if there are no active organizations
                  hidden: activeOrgs.length === 0,
                },
                {
                  key: 'inactive-ogs',
                  children: orderBy(inactiveOrgs, ['name']).map(
                    makeInactiveOrganizationMenuItem
                  ),
                  // Hide entire submenu if there are no inactive organizations
                  hidden: inactiveOrgs.length === 0,
                },
                makeCreateOrganizationMenuItem(),
              ],
            },
          ],
        },
      ]}
    />
  );
}

function makeOrganizationMenuItem(org: Organization): MenuItemProps {
  return {
    key: org.id,
    label: <OrganizationBadge organization={org} />,
    textValue: org.name,
    to: resolveRoute(`/organizations/${org.slug}/issues/`, null, org),
  };
}

function makeInactiveOrganizationMenuItem(org: Organization): MenuItemProps {
  return {
    ...makeOrganizationMenuItem(org),
    trailingItems: <QuestionTooltip size="sm" title={org.status.name} />,
  };
}

function makeCreateOrganizationMenuItem(): MenuItemProps {
  const configFeatures = ConfigStore.get('features');

  const menuItemProps: MenuItemProps = {
    key: 'create-organization',
    leadingItems: <IconAdd />,
    label: t('Create a new organization'),
  };

  if (configFeatures.has('system:multi-region')) {
    menuItemProps.externalHref =
      localizeDomain(ConfigStore.get('links').sentryUrl) + '/organizations/new/';
  } else {
    menuItemProps.to = '/organizations/new/';
  }

  return {
    key: 'create-organization-section',
    children: [menuItemProps],
    hidden: !ConfigStore.get('features').has('organizations:create'),
  };
}

const OrganizationDropdownTrigger = styled(Button)<{layout: NavLayout}>`
  height: ${p => (p.layout === NavLayout.MOBILE ? 32 : 48)}px;
  width: ${p => (p.layout === NavLayout.MOBILE ? 32 : 48)}px;
  min-height: ${p => (p.layout === NavLayout.MOBILE ? 32 : 48)}px;
  padding: 0;
`;

const SectionTitleWrapper = styled('div')`
  text-transform: none;
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.normal};
  color: ${p => p.theme.tokens.content.primary};
`;
