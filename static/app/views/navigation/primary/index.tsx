import {Fragment, useRef} from 'react';
import styled from '@emotion/styled';
import {mergeProps} from '@react-aria/utils';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Stack} from '@sentry/scraps/layout';

import Feature from 'sentry/components/acl/feature';
import ErrorBoundary from 'sentry/components/errorBoundary';
import Hook from 'sentry/components/hook';
import {
  IconCompass,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconSettings,
  IconSiren,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useOrganization} from 'sentry/utils/useOrganization';
import {getDefaultExploreRoute} from 'sentry/views/explore/utils';
import {
  NavigationTour,
  NavigationTourElement,
} from 'sentry/views/navigation/navigationTour';
import {PrimaryNavigation} from 'sentry/views/navigation/primary/components';
import {PrimaryNavigationHelpMenu} from 'sentry/views/navigation/primary/helpMenu';
import {PrimaryNavigationOnboarding} from 'sentry/views/navigation/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/navigation/primary/serviceIncidents';
import {useActivateNavigationGroupOnHover} from 'sentry/views/navigation/primary/useActivateNavigationGroupOnHover';
import {UserDropdown} from 'sentry/views/navigation/primary/userDropdown';
import {PrimaryNavigationWhatsNew} from 'sentry/views/navigation/primary/whatsNew';

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const prefix = `organizations/${organization.slug}`;
  const ref = useRef<HTMLUListElement>(null);

  const makeNavigationItemProps = useActivateNavigationGroupOnHover({ref});

  return (
    <Fragment>
      <PrimaryNavigation.List ref={ref}>
        <NavigationTourElement id={NavigationTour.ISSUES} title={null} description={null}>
          {tourProps => (
            <PrimaryNavigation.ListItem>
              <PrimaryNavigation.Link
                to={`/${prefix}/issues/`}
                analyticsKey="issues"
                label={t('Issues')}
                {...mergeProps(
                  makeNavigationItemProps('issues', `/${prefix}/issues/`),
                  tourProps
                )}
              >
                <IconIssues />
              </PrimaryNavigation.Link>
            </PrimaryNavigation.ListItem>
          )}
        </NavigationTourElement>

        <NavigationTourElement
          id={NavigationTour.EXPLORE}
          title={null}
          description={null}
        >
          {tourProps => (
            <PrimaryNavigation.ListItem>
              <PrimaryNavigation.Link
                to={`/${prefix}/explore/${getDefaultExploreRoute(organization)}/`}
                analyticsKey="explore"
                label={t('Explore')}
                {...mergeProps(
                  makeNavigationItemProps(
                    'explore',
                    `/${prefix}/explore/${getDefaultExploreRoute(organization)}/`,
                    `/${prefix}/explore`
                  ),
                  tourProps
                )}
              >
                <IconCompass />
              </PrimaryNavigation.Link>
            </PrimaryNavigation.ListItem>
          )}
        </NavigationTourElement>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <NavigationTourElement
            id={NavigationTour.DASHBOARDS}
            title={null}
            description={null}
          >
            {tourProps => (
              <PrimaryNavigation.ListItem>
                <PrimaryNavigation.Link
                  to={`/${prefix}/dashboards/`}
                  analyticsKey="dashboards"
                  label={t('Dashboards')}
                  {...mergeProps(
                    makeNavigationItemProps(
                      'dashboards',
                      `/${prefix}/dashboards/`,
                      `/${prefix}/dashboard`
                    ),
                    tourProps
                  )}
                >
                  <IconDashboard />
                </PrimaryNavigation.Link>
              </PrimaryNavigation.ListItem>
            )}
          </NavigationTourElement>
        </Feature>

        <Feature features={['performance-view']}>
          <NavigationTourElement
            id={NavigationTour.INSIGHTS}
            title={null}
            description={null}
          >
            {tourProps => (
              <PrimaryNavigation.ListItem>
                <PrimaryNavigation.Link
                  to={`/${prefix}/insights/`}
                  analyticsKey="insights"
                  label={t('Insights')}
                  {...mergeProps(
                    makeNavigationItemProps(
                      'insights',
                      `/${prefix}/insights/`,
                      `/${prefix}/insights`
                    ),
                    tourProps
                  )}
                >
                  <IconGraph type="area" />
                </PrimaryNavigation.Link>
              </PrimaryNavigation.ListItem>
            )}
          </NavigationTourElement>
        </Feature>

        <PrimaryNavigation.ListItem padding="0 md">
          <PrimaryNavigation.Separator />
        </PrimaryNavigation.ListItem>

        <Feature features={['workflow-engine-ui']}>
          <PrimaryNavigation.ListItem>
            <PrimaryNavigation.Link
              to={`/${prefix}/monitors/`}
              analyticsKey="monitors"
              label={t('Monitors')}
              {...makeNavigationItemProps('monitors', `/${prefix}/monitors/`)}
            >
              <IconSiren />
              <BetaBadge type="alpha" aria-hidden="true" />
            </PrimaryNavigation.Link>
          </PrimaryNavigation.ListItem>
        </Feature>

        <NavigationTourElement
          id={NavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          {tourProps => (
            <PrimaryNavigation.ListItem>
              <PrimaryNavigation.Link
                to={`/settings/${organization.slug}/`}
                analyticsKey="settings"
                label={t('Settings')}
                {...mergeProps(
                  makeNavigationItemProps(
                    'settings',
                    `/settings/${organization.slug}/`,
                    '/settings/'
                  ),
                  tourProps
                )}
              >
                <IconSettings />
              </PrimaryNavigation.Link>
            </PrimaryNavigation.ListItem>
          )}
        </NavigationTourElement>
      </PrimaryNavigation.List>

      <Stack gap="md" marginTop="auto" paddingBottom="md">
        <PrimaryNavigation.FooterItems>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationOnboarding />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:try-business" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:seer-config-reminder" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <Hook name="sidebar:billing-status" organization={organization} />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationServiceIncidents />
          </ErrorBoundary>
          <ErrorBoundary customComponent={null}>
            <PrimaryNavigationWhatsNew />
          </ErrorBoundary>
          <PrimaryNavigationHelpMenu />
        </PrimaryNavigation.FooterItems>
        <PrimaryNavigation.FooterItems>
          <UserDropdown />
        </PrimaryNavigation.FooterItems>
      </Stack>
    </Fragment>
  );
}

const BetaBadge = styled(FeatureBadge)`
  pointer-events: none;
  position: absolute;
  top: 0px;
  right: 6px;
  font-size: ${p => p.theme.font.size.xs};
  padding: 0 ${p => p.theme.space.xs};
  height: 16px;
`;
