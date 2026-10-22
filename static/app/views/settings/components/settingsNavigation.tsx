import {cloneElement, Fragment} from 'react';
import {matchPath} from 'react-router';
import {mergeProps} from '@react-aria/utils';
import {IconAdd} from '@sentry/icons/add';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {CompactSelect, MenuComponents} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';
import {Text} from '@sentry/scraps/text';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useCanCreateProject} from 'sentry/utils/useCanCreateProject';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';
import {SettingsNavigationGroup} from 'sentry/views/settings/components/settingsNavigationGroup';
import type {NavigationProps, NavigationSection} from 'sentry/views/settings/types';
import {useSettingsV3} from 'sentry/views/settings/useSettingsV3';

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
  const location = useLocation();
  const settingsV3 = useSettingsV3();
  const isProjectSettings = !!matchPath(
    {path: '/settings/:orgId?/projects/:projectId', end: false},
    location.pathname
  );
  const showProjectSelector = settingsV3 && isProjectSettings;
  const title = settingsV3
    ? matchPath({path: '/settings/account', end: false}, location.pathname)
      ? t('Account Settings')
      : isProjectSettings
        ? t('Project Settings')
        : t('Organization Settings')
    : t('Settings');

  return (
    <ErrorBoundary customComponent={null}>
      <SecondaryNavigation.Header
        trailingItems={settingsV3 ? undefined : <SecondaryNavigation.Toggle />}
        padding={showProjectSelector ? '0 sm' : undefined}
      >
        {showProjectSelector ? <SettingsProjectSelector /> : title}
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
  const {projectId} = useParams<{projectId?: string}>();
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
          menuWidth="100%"
          preventOverflowOptions={{boundary: 'clippingAncestors'}}
          value={projectId ?? ''}
          trigger={triggerProps => (
            <Container width="100%">
              {buttonProps => (
                <OverlayTrigger.Button
                  {...mergeProps(buttonProps, triggerProps)}
                  aria-label={t('Select a project')}
                  icon={
                    selectedProject ? (
                      <ProjectAvatar project={selectedProject} size={16} />
                    ) : undefined
                  }
                >
                  <Container flex="1" minWidth="0">
                    <Text ellipsis align="left">
                      {projectId ?? t('Select a project')}
                    </Text>
                  </Container>
                </OverlayTrigger.Button>
              )}
            </Container>
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
          onChange={selection =>
            navigate(
              normalizeUrl(
                `/settings/${organization.slug}/projects/${selection.value}/${subpage ? `${subpage}/` : ''}`
              )
            )
          }
        />
      )}
    </Container>
  );
}
