import {Fragment} from 'react';
import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {openHelpSearchModal} from 'sentry/actionCreators/modal';
import Feature from 'sentry/components/acl/feature';
import {NAV_GROUP_LABELS} from 'sentry/components/nav/constants';
import {useNavContext} from 'sentry/components/nav/context';
import {
  SeparatorItem,
  SidebarLink,
  SidebarMenu,
} from 'sentry/components/nav/primary/components';
import {PrimaryNavigationOnboarding} from 'sentry/components/nav/primary/onboarding';
import {PrimaryNavigationServiceIncidents} from 'sentry/components/nav/primary/serviceIncidents';
import {WhatsNew} from 'sentry/components/nav/primary/whatsNew';
import {NavLayout, PrimaryNavGroup} from 'sentry/components/nav/types';
import {
  IconDashboard,
  IconGraph,
  IconIssues,
  IconQuestion,
  IconSearch,
  IconSettings,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import ConfigStore from 'sentry/stores/configStore';
import {space} from 'sentry/styles/space';
import {trackAnalytics} from 'sentry/utils/analytics';
import useMutateUserOptions from 'sentry/utils/useMutateUserOptions';
import useOrganization from 'sentry/utils/useOrganization';

function SidebarBody({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarItemList isMobile={layout === NavLayout.MOBILE}>{children}</SidebarItemList>
  );
}

function SidebarFooter({children}: {children: React.ReactNode}) {
  const {layout} = useNavContext();
  return (
    <SidebarFooterWrapper>
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
  const prefix = `organizations/${organization.slug}`;

  const {mutate: mutateUserOptions} = useMutateUserOptions();

  return (
    <Fragment>
      <SidebarBody>
        <SidebarLink
          to={`/${prefix}/issues/`}
          analyticsKey="issues"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.ISSUES]}
        >
          <IconIssues />
        </SidebarLink>

        <SidebarLink
          to={`/${prefix}/explore/traces/`}
          analyticsKey="explore"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.EXPLORE]}
        >
          <IconSearch />
        </SidebarLink>

        <Feature
          features={['discover', 'discover-query', 'dashboards-basic', 'dashboards-edit']}
          hookName="feature-disabled:dashboards-sidebar-item"
          requireAll={false}
        >
          <SidebarLink
            to={`/${prefix}/dashboards/`}
            activeTo={`/${prefix}/dashboard`}
            analyticsKey="customizable-dashboards"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.DASHBOARDS]}
          >
            <IconDashboard />
          </SidebarLink>
        </Feature>

        <Feature features={['performance-view']}>
          <SidebarLink
            to={`/${prefix}/insights/frontend/`}
            analyticsKey="insights-domains"
            label={NAV_GROUP_LABELS[PrimaryNavGroup.INSIGHTS]}
          >
            <IconGraph />
          </SidebarLink>
        </Feature>

        <SeparatorItem />

        <SidebarLink
          to={`/${prefix}/settings/${organization.slug}/`}
          activeTo={`/${prefix}/settings/`}
          analyticsKey="settings"
          label={NAV_GROUP_LABELS[PrimaryNavGroup.SETTINGS]}
        >
          <IconSettings />
        </SidebarLink>
      </SidebarBody>

      <SidebarFooter>
        <SidebarMenu
          items={[
            {
              key: 'search',
              label: t('Search Support, Docs and More'),
              onAction() {
                openHelpSearchModal({organization});
              },
            },
            {
              key: 'resources',
              label: t('Resources'),
              children: [
                {
                  key: 'help-center',
                  label: t('Help Center'),
                  to: 'https://sentry.zendesk.com/hc/en-us',
                },
                {
                  key: 'docs',
                  label: t('Documentation'),
                  to: 'https://docs.sentry.io',
                },
              ],
            },
            {
              key: 'help',
              label: t('Get Help'),
              children: [
                {
                  key: 'support',
                  label: t('Contact Support'),
                  to: `mailto:${ConfigStore.get('supportEmail')}`,
                },
                {
                  key: 'github',
                  label: t('Sentry on GitHub'),
                  to: 'https://github.com/getsentry/sentry/issues',
                },
                {
                  key: 'discord',
                  label: t('Join our Discord'),
                  to: 'https://discord.com/invite/sentry',
                },
              ],
            },
            {
              key: 'new-ui',
              children: [
                {
                  key: 'new-ui',
                  label: t('Switch to old navigation'),
                  onAction() {
                    mutateUserOptions({prefersStackedNavigation: false});
                    trackAnalytics(
                      'navigation.help_menu_opt_out_stacked_navigation_clicked',
                      {
                        organization,
                      }
                    );
                  },
                },
              ],
            },
          ]}
          analyticsKey="help"
          label={t('Help')}
        >
          <IconQuestion />
        </SidebarMenu>

        <SeparatorItem />

        <WhatsNew />
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
  color: rgba(255, 255, 255, 0.85);

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

const SidebarFooterWrapper = styled('div')`
  position: relative;
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-top: auto;
`;
