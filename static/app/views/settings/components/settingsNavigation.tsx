import {cloneElement, Fragment} from 'react';
import {matchPath} from 'react-router';
import {mergeProps} from '@react-aria/utils';
import {IconAdd} from '@sentry/icons/add';
import orderBy from 'lodash/orderBy';
import {useStore} from 'zustand';

import {OrganizationAvatar, ProjectAvatar} from '@sentry/scraps/avatar';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {InfoTip} from '@sentry/scraps/info';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger, type TriggerProps} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {ConfigStore} from 'sentry/stores/configStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import {isDemoModeActive} from 'sentry/utils/demoMode';
import {getCreateOrganizationLink} from 'sentry/utils/organization/getCreateOrganizationLink';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {resolveRoute} from 'sentry/utils/resolveRoute';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useOrganizations} from 'sentry/utils/useOrganizations';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {getSettingsScopeTitle} from 'sentry/views/settings/settingsScope';
import type {NavigationProps, NavigationSection} from 'sentry/views/settings/types';
import {useSettingsProjectSwitchTemplate} from 'sentry/views/settings/useSettingsProjectSwitchTemplate';
import {useSettingsScope} from 'sentry/views/settings/useSettingsScope';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

import {SettingsNavigationGroup} from './settingsNavigationGroup';

type Props = NavigationProps & {
  /**
   * Additional navigation configuration driven by hooks
   */
  hookConfigs: NavigationSection[];
  /**
   * Additional navigation elements driven from hooks
   */
  hooks: React.ReactElement[];
  /**
   * The configuration for this navigation panel
   */
  navigationObjects: NavigationSection[];
};

export function SettingsNavigation({
  navigationObjects,
  hookConfigs,
  hooks,
  ...otherProps
}: Props) {
  const navWithHooks = navigationObjects.concat(hookConfigs);
  const settingsV3 = useSettingsV3();
  const {scope} = useSettingsScope();
  const title = settingsV3 && scope ? getSettingsScopeTitle(scope) : t('Settings');

  return (
    <ErrorBoundary customComponent={null}>
      <SecondaryNavigation.Header>
        {settingsV3 && scope === 'project' ? (
          <SettingsProjectSelector />
        ) : settingsV3 && scope === 'org' ? (
          <SettingsOrganizationHeader />
        ) : (
          <SecondaryNavigation.HeaderTitle>{title}</SecondaryNavigation.HeaderTitle>
        )}
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        {navWithHooks.map((config, index) => (
          <Fragment key={config.name}>
            {index > 0 && <SecondaryNavigation.Separator />}
            <SettingsNavigationGroup {...otherProps} {...config} />
          </Fragment>
        ))}
        {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
      </SecondaryNavigation.Body>
    </ErrorBoundary>
  );
}

function SettingsProjectSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const subpage = matchPath('/settings/:orgId?/projects/:projectId/*', location.pathname)
    ?.params['*'];
  const params = useParams<{projectId: string; orgId?: string}>();
  const {projectId} = params;
  const switchTo = useSettingsProjectSwitchTemplate();
  const {projects, onSearch} = useProjects();
  const selectedProject = projects.find(project => project.slug === projectId);
  const organization = useOrganization();
  const canCreateProject = useCanCreateProject();

  return (
    <Container width="100%">
      {containerProps => (
        <CompactSelect
          {...containerProps}
          size="sm"
          position="bottom-start"
          // Same max width as the environment page filter menu
          menuWidth="24em"
          preventOverflowOptions={{boundary: 'clippingAncestors'}}
          value={projectId}
          trigger={triggerProps => (
            <SettingsHeaderSelectTrigger
              triggerProps={triggerProps}
              aria-label={t('Select a project')}
              icon={
                selectedProject ? (
                  <ProjectAvatar project={selectedProject} size={16} />
                ) : undefined
              }
              label={projectId}
            />
          )}
          search={{onChange: onSearch}}
          menuFooter={
            <MenuComponents.CTALinkButton
              icon={<IconAdd />}
              to={makeProjectsPathname({path: '/new/', organization})}
              disabled={!canCreateProject}
              tooltipProps={{
                title: canCreateProject
                  ? undefined
                  : t('You do not have permission to create projects'),
              }}
            >
              {t('Create Project')}
            </MenuComponents.CTALinkButton>
          }
          options={projects.map(project => ({
            value: project.slug,
            label: project.slug,
            leadingItems: <ProjectAvatar project={project} size={16} />,
          }))}
          onChange={selection => {
            trackAnalytics('settings.project_selector.changed', {organization});
            navigate(
              normalizeUrl(
                switchTo
                  ? replaceRouterParams(switchTo, {
                      ...params,
                      orgId: organization.slug,
                      projectId: selection.value,
                    })
                  : `/settings/${organization.slug}/projects/${selection.value}/${subpage ? `${subpage}/` : ''}`
              )
            );
          }}
        />
      )}
    </Container>
  );
}

function SettingsHeaderSelectTrigger({
  triggerProps,
  label,
  icon,
  'aria-label': ariaLabel,
}: {
  'aria-label': string;
  icon: React.ReactNode;
  label: React.ReactNode;
  triggerProps: TriggerProps;
}) {
  return (
    // A one-column grid on the trigger itself stretches the label across
    // the full width: transparent buttons otherwise size it to its content.
    <Grid width="100%" columns="minmax(0, 1fr)">
      {buttonProps => (
        <OverlayTrigger.Button
          {...mergeProps(buttonProps, triggerProps)}
          variant="transparent"
          aria-label={ariaLabel}
          icon={icon}
        >
          <Container flex="1" minWidth="0">
            <Text ellipsis align="left">
              {label}
            </Text>
          </Container>
        </OverlayTrigger.Button>
      )}
    </Grid>
  );
}

function SettingsOrganizationHeader() {
  const organization = useOrganization();
  const organizations = useOrganizations();
  const singleOrganization = useStore(ConfigStore, state => state.singleOrganization);

  if (singleOrganization || isDemoModeActive() || organizations.length <= 1) {
    return (
      <SecondaryNavigation.HeaderTitle>
        <Flex as="span" align="center" gap="sm" minWidth="0">
          <OrganizationAvatar organization={organization} size={16} />
          <Text ellipsis>{organization.name}</Text>
        </Flex>
      </SecondaryNavigation.HeaderTitle>
    );
  }

  return <SettingsOrganizationSelector />;
}

/**
 * The first path segment after the organization in a settings URL, e.g.
 * `members` for `/settings/org-slug/members/123/`. Deeper segments usually
 * point at objects that only exist in the current organization, so switching
 * organizations keeps the section and drops the rest.
 */
function getOrganizationSettingsSection(pathname: string, orgSlug: string) {
  const segments = pathname.split('/').filter(Boolean);
  // Customer domain URLs leave the organization slug out of the path.
  const sectionIndex = segments[1] === orgSlug ? 2 : 1;
  return segments[sectionIndex];
}

function SettingsOrganizationSelector() {
  const navigate = useNavigate();
  const location = useLocation();
  const organization = useOrganization();
  const organizations = useOrganizations();
  const canCreateOrganization = ConfigStore.get('features').has('organizations:create');

  const section = getOrganizationSettingsSection(location.pathname, organization.slug);

  return (
    <Container width="100%">
      {containerProps => (
        <CompactSelect
          {...containerProps}
          size="sm"
          position="bottom-start"
          menuWidth="24em"
          preventOverflowOptions={{boundary: 'clippingAncestors'}}
          value={organization.slug}
          trigger={triggerProps => (
            <SettingsHeaderSelectTrigger
              triggerProps={triggerProps}
              aria-label={t('Select an organization')}
              icon={<OrganizationAvatar organization={organization} size={16} />}
              label={organization.name}
            />
          )}
          search
          menuFooter={
            canCreateOrganization ? (
              <MenuComponents.CTALinkButton
                icon={<IconAdd />}
                {...getCreateOrganizationLink()}
              >
                {t('Create Organization')}
              </MenuComponents.CTALinkButton>
            ) : undefined
          }
          options={orderBy(organizations, ['name']).map(org => ({
            value: org.slug,
            label: org.name,
            textValue: org.name,
            leadingItems: <OrganizationAvatar organization={org} size={16} />,
            trailingItems:
              org.status.id === 'active' ? undefined : (
                <InfoTip size="sm" title={org.status.name} />
              ),
          }))}
          onChange={selection => {
            const org = organizations.find(o => o.slug === selection.value);
            if (!org || org.slug === organization.slug) {
              return;
            }
            trackAnalytics('settings.organization_selector.changed', {organization});
            const url = resolveRoute(
              `/settings/${org.slug}/${section ? `${section}/` : ''}`,
              null,
              org
            );
            if (url.startsWith('http')) {
              window.location.assign(url);
            } else {
              navigate(url);
            }
          }}
        />
      )}
    </Container>
  );
}
