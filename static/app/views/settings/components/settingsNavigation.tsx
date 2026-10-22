import {cloneElement, Fragment} from 'react';

import {ProjectAvatar} from '@sentry/scraps/avatar';
import {CompactSelect} from '@sentry/scraps/compactSelect';
import {Container} from '@sentry/scraps/layout';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {ErrorBoundary} from 'sentry/components/errorBoundary';
import {t} from 'sentry/locale';
import {normalizeUrl} from 'sentry/utils/url/normalizeUrl';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useParams} from 'sentry/utils/useParams';
import {useProjects} from 'sentry/utils/useProjects';
import {SecondaryNavigation} from 'sentry/views/navigation/secondary/components';
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
  const navigate = useNavigate();
  const {projectId} = useParams<{projectId?: string}>();
  const {projects, onSearch} = useProjects();
  const selectedProject = projects.find(project => project.slug === projectId);
  const showProjectSelector = settingsV3 && /\/projects(?:\/|$)/.test(location.pathname);
  const title = settingsV3
    ? location.pathname.startsWith('/settings/account/')
      ? t('Account Settings')
      : /\/projects(?:\/|$)/.test(location.pathname)
        ? t('Project Settings')
        : t('Organization Settings')
    : t('Settings');

  return (
    <ErrorBoundary customComponent={null}>
      <SecondaryNavigation.Header
        showToggle={!settingsV3}
        padding={showProjectSelector ? '0 sm' : undefined}
      >
        {showProjectSelector ? (
          <Container width="100%">
            {containerProps => (
              <CompactSelect
                {...containerProps}
                size="sm"
                position="bottom-start"
                menuWidth="100%"
                preventOverflowOptions={{boundary: 'clippingAncestors', padding: 8}}
                value={projectId ?? ''}
                trigger={triggerProps => (
                  <Container width="100%">
                    {buttonProps => (
                      <OverlayTrigger.Button
                        {...buttonProps}
                        {...triggerProps}
                        aria-label={t('Select a project')}
                        icon={
                          selectedProject ? (
                            <ProjectAvatar project={selectedProject} size={16} />
                          ) : undefined
                        }
                      >
                        {projectId ?? t('All Projects')}
                      </OverlayTrigger.Button>
                    )}
                  </Container>
                )}
                search={{onChange: onSearch}}
                options={[
                  {value: '', label: t('All Projects')},
                  ...projects.map(project => ({
                    value: project.slug,
                    label: project.slug,
                    leadingItems: <ProjectAvatar project={project} size={16} />,
                  })),
                ]}
                onChange={selection =>
                  navigate(
                    normalizeUrl(
                      selection.value
                        ? `/settings/${otherProps.organization?.slug}/projects/${selection.value}/`
                        : `/settings/${otherProps.organization?.slug}/projects/?view=all`
                    )
                  )
                }
              />
            )}
          </Container>
        ) : (
          title
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
