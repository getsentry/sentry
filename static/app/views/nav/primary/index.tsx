import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import Feature from 'sentry/components/acl/feature';
import Hook from 'sentry/components/hook';
import {
  IconCodecov,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconSearch,
  IconSettings,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {CODECOV_BASE_URL, COVERAGE_BASE_URL} from 'sentry/views/codecov/settings';
import {useNavContext} from 'sentry/views/nav/context';
import {SeparatorItem, SidebarLink} from 'sentry/views/nav/primary/components';
import {PRIMARY_NAV_GROUP_CONFIG} from 'sentry/views/nav/primary/config';
import {PrimaryNavigationHelp} from 'sentry/views/nav/primary/help';
import {PrimaryNavigationOnboarding} from 'sentry/views/nav/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/views/nav/primary/serviceIncidents';
import {PrimaryNavigationWhatsNew} from 'sentry/views/nav/primary/whatsNew';
import {NavTourElement, StackedNavigationTour} from 'sentry/views/nav/tour/tour';
import {NavLayout, PrimaryNavGroup} from 'sentry/views/nav/types';

function SidebarBody({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarItemList isMobile={layout === NavLayout.MOBILE}>{children}</SidebarItemList>
  );
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarFooterWrapper isMobile={layout === NavLayout.MOBILE}>
      <SidebarItemList
        isMobile={layout === NavLayout.MOBILE}
        compact={layout === NavLayout.SIDEBAR}
      >
        {children}
      </SidebarItemList>
    </SidebarFooterWrapper>
  );
}

export function PrimaryNavigationItems() {
  const organization = useOrganization();
  const {layout} = useNavContext();
  const prefix = `organizations/${organization.slug}`;

  return (
    <Fragment>
      <SidebarBody>
        <NavTourElement id={StackedNavigationTour.ISSUES} title={null} description={null}>
          <SidebarLink
            to={`/${prefix}/issues/`}
            analyticsKey="issues"
            label={PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.ISSUES].label}
          >
            <IconIssues />
          </SidebarLink>
        </NavTourElement>

        <NavTourElement
          id={StackedNavigationTour.EXPLORE}
          title={null}
          description={null}
        >
          <SidebarLink
            to={
              organization.features.includes('performance-view')
                ? `/${prefix}/explore/traces/`
                : `/${prefix}/explore/profiling/`
            }
            activeTo={`/${prefix}/explore`}
            analyticsKey="explore"
            label={PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.EXPLORE].label}
          >
            <IconSearch />
          </SidebarLink>
        </NavTourElement>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <NavTourElement
            id={StackedNavigationTour.DASHBOARDS}
            title={null}
            description={null}
          >
            <SidebarLink
              to={`/${prefix}/dashboards/`}
              activeTo={`/${prefix}/dashboard`}
              analyticsKey="dashboards"
              label={
                layout === NavLayout.MOBILE
                  ? PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.DASHBOARDS].label
                  : t('Dash')
              }
            >
              <IconDashboard />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <Feature features={['performance-view']}>
          <NavTourElement
            id={StackedNavigationTour.INSIGHTS}
            title={null}
            description={null}
          >
            <SidebarLink
              to={`/${prefix}/insights/frontend/`}
              activeTo={`/${prefix}/insights`}
              analyticsKey="insights"
              label={PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.INSIGHTS].label}
            >
              <IconGraph type="area" />
            </SidebarLink>
          </NavTourElement>
        </Feature>

        <Feature features={['codecov-ui']}>
          <SidebarLink
            to={`/${prefix}/${CODECOV_BASE_URL}/${COVERAGE_BASE_URL}/commits/`}
            activeTo={`/${prefix}/${CODECOV_BASE_URL}/`}
            analyticsKey="codecov"
            label={PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.CODECOV].label}
          >
            <IconCodecov />
          </SidebarLink>
        </Feature>

        <SeparatorItem />

        <NavTourElement
          id={StackedNavigationTour.SETTINGS}
          title={null}
          description={null}
        >
          <SidebarLink
            to={`/${prefix}/settings/${organization.slug}/`}
            activeTo={`/${prefix}/settings/`}
            analyticsKey="settings"
            label={PRIMARY_NAV_GROUP_CONFIG[PrimaryNavGroup.SETTINGS].label}
          >
            <IconSettings />
          </SidebarLink>
        </NavTourElement>
      </SidebarBody>

      <SidebarFooter>
        <PrimaryNavigationHelp />

        <SeparatorItem />

        <PrimaryNavigationWhatsNew />
        <Hook
          name="sidebar:try-business"
          organization={organization}
          orientation="left"
        />
        <Hook name="sidebar:billing-status" organization={organization} />
        <PrimaryNavigationServiceIncidents />
        <PrimaryNavigationOnboarding />
      </SidebarFooter>
    </Fragment>
  );
}

const SidebarItemList = styled('ul')<{isMobile: boolean; compact?: boolean}>`
  position: relative;
  list-style: none;
  margin: 0;
  padding: 0;
  padding-top: ${space(1)};
  display: flex;
  flex-direction: column;
  align-items: stretch;
  gap: ${space(0.5)};
  width: 100%;

  ${p =>
    !p.isMobile &&
    css`
      align-items: center;
      gap: ${space(0.5)};
    `}

  ${p =>
    p.compact &&
    css`
      gap: ${space(0.5)};
    `}
`;

const SidebarFooterWrapper = styled('div')<{isMobile: boolean}>`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
  margin-bottom: ${p => (p.isMobile ? space(1) : 0)};
`;
