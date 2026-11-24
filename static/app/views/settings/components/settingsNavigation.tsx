import {cloneElement, Fragment} from 'react';
import {matchPath, useParams as useRouteParams} from 'react-router';
import {mergeProps} from '@react-aria/utils';
import {IconAdd} from '@sentry/icons/add';
import orderBy from 'lodash/orderBy';

import {OrganizationAvatar, ProjectAvatar} from '@sentry/scraps/avatar';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {Container, Flex, Grid} from '@sentry/scraps/layout';
import {OverlayTrigger, type TriggerProps} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {getOrganizationItemProps} from 'sentry/utils/organization/getOrganizationItemProps';
import {useCreateOrganizationLink} from 'sentry/utils/organization/useCreateOrganizationLink';
import {useOrganizationSwitcher} from 'sentry/utils/organization/useOrganizationSwitcher';
import {replaceRouterParams} from 'sentry/utils/replaceRouterParams';
import {unreachable} from 'sentry/utils/unreachable';
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

  return (
    <ErrorBoundary customComponent={null}>
      <SecondaryNavigation.Header>
        <SettingsNavigationHeader />
      </SecondaryNavigation.Header>
      <SecondaryNavigation.Body>
        {navWithHooks.map((config, index) => (
          <Fragment key={config.name}>
            {index > 0 && <SecondaryNavigation.Separator />}
            <SettingsNavigationGroup {...otherProps} {...config} />
          </Fragment>
        ))}
        {hooks.length > 0 && (
          <SecondaryNavigation.SectionGroup
            id="settings-additional"
            tabLabel={t('More Settings')}
          >
            {hooks.map((Hook, i) => cloneElement(Hook, {key: `hook-${i}`}))}
          </SecondaryNavigation.SectionGroup>
        )}
      </SecondaryNavigation.Body>
    </ErrorBoundary>
  );
}

function SettingsNavigationHeader() {
  const settingsV3 = useSettingsV3();
  const {scope} = useSettingsScope();

  if (!settingsV3 || !scope) {
    return (
      <SecondaryNavigation.HeaderTitle>{t('Settings')}</SecondaryNavigation.HeaderTitle>
    );
  }

  switch (scope) {
    case 'project':
      return <SettingsProjectSelector />;
    case 'org':
      return <SettingsOrganizationHeader />;
    case 'account':
      return (
        <SecondaryNavigation.HeaderTitle>
          {getSettingsScopeTitle(scope)}
        </SecondaryNavigation.HeaderTitle>
      );
    default:
      return unreachable(scope);
  }
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
  const {canSwitch} = useOrganizationSwitcher();

  if (canSwitch) {
    return <SettingsOrganizationSelector />;
  }

  // Same height, padding and icon spacing as the selector trigger, so the
  // header doesn't shift between users with one organization and with several.
  return (
    <Flex
      align="center"
      gap="md"
      height="32px"
      minWidth="0"
      paddingLeft="lg"
      paddingRight="lg"
    >
      <Flex flexShrink={0}>
        <OrganizationAvatar organization={organization} size={16} />
      </Flex>
      <Text ellipsis>{organization.name}</Text>
    </Flex>
  );
}

/**
 * The settings section the user is on, e.g. `members` for
 * `/settings/org-slug/members/123/`. Deeper segments point at objects of the
 * current organization, so switching organizations keeps only the section.
 */
function useOrganizationSettingsSection(): string | undefined {
  const {pathname} = useLocation();
  // Read the matched route rather than our useParams, which fills in orgId on
  // customer domains even though their paths have no slug.
  const {orgId} = useRouteParams();
  return pathname.split('/').filter(Boolean)[orgId === undefined ? 1 : 2];
}

function SettingsOrganizationSelector() {
  const organization = useOrganization();
  const organizations = useOrganizations();
  const {switchTo} = useOrganizationSwitcher();
  const createOrganizationLink = useCreateOrganizationLink();
  const section = useOrganizationSettingsSection();

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
            createOrganizationLink ? (
              <MenuComponents.CTALinkButton
                icon={<IconAdd />}
                {...createOrganizationLink}
              >
                {t('Create Organization')}
              </MenuComponents.CTALinkButton>
            ) : undefined
          }
          options={orderBy(organizations, ['name']).map(org => ({
            value: org.slug,
            textValue: org.name,
            ...getOrganizationItemProps(org),
          }))}
          onChange={selection => {
            const org = organizations.find(o => o.slug === selection.value);
            if (!org || org.slug === organization.slug) {
              return;
            }
            trackAnalytics('settings.organization_selector.changed', {organization});
            switchTo(org, `/settings/${org.slug}/${section ? `${section}/` : ''}`);
          }}
        />
      )}
    </Container>
  );
}
