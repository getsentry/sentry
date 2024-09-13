import styled from '@emotion/styled';
import {AnimatePresence} from 'framer-motion';

import OrganizationAvatar from 'sentry/components/avatar/organizationAvatar';
import Sidebar from 'sentry/components/nav/sidebar';
import Submenu from 'sentry/components/nav/submenu';
import type {NavItems} from 'sentry/components/nav/utils';
import {isActive, NAV_DIVIDER, splitAtDivider} from 'sentry/components/nav/utils';
import {
  IconBroadcast,
  IconDashboard,
  IconGraph,
  IconIssues,
  IconLightning,
  IconProject,
  IconQuestion,
  IconSearch,
  IconSettings,
  IconSiren,
  IconStats,
} from 'sentry/icons';
import {t} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import useOrganization from 'sentry/utils/useOrganization';

const items: NavItems = [
  {
    label: t('Issues'),
    to: '/issues/',
    icon: <IconIssues />,
    submenu: [
      {label: t('All'), to: '/issues/'},
      {label: t('Error & Outage'), to: '/issues/error/'},
      {label: t('Trend'), to: '/issues/trends/'},
      {label: t('Craftsmanship'), to: '/issues/craftsmanship/'},
      {label: t('Security'), to: '/issues/security/'},
      {label: t('Feedback'), to: '/user-feedback/'},
    ],
  },
  {label: t('Projects'), to: '/projects/', icon: <IconProject />},
  {
    label: t('Explore'),
    to: '/traces/',
    icon: <IconSearch />,
    submenu: [
      {label: t('Traces'), to: '/traces/'},
      {label: t('Metrics'), to: '/metrics/'},
      {label: t('Profiles'), to: '/profiles/'},
      {label: t('Replays'), to: '/replays/'},
      {label: t('Discover'), to: '/discover/homepage/'},
      {label: t('Releases'), to: '/releases/'},
      {label: t('Crons'), to: '/crons/'},
    ],
  },
  {
    label: t('Insights'),
    to: '/insights/http/',
    icon: <IconGraph />,
    submenu: [
      {label: t('Requests'), to: '/insights/http/'},
      {label: t('Queries'), to: '/insights/database/'},
      {label: t('Assets'), to: '/insights/browser/assets/'},
      {label: t('App Starts'), to: '/insights/mobile/app-startup/'},
      {label: t('Screen Loads'), to: '/insights/mobile/screens/'},
      {label: t('Web Vitals'), to: '/insights/browser/pageloads/'},
      {label: t('Caches'), to: '/insights/caches/'},
      {label: t('Queues'), to: '/insights/queues/'},
      {label: t('LLM Monitoring'), to: '/insights/llm-monitoring/'},
    ],
  },
  {label: t('Perf.'), to: '/performance/', icon: <IconLightning />},
  {label: t('Boards'), to: '/dashboards/', icon: <IconDashboard />},
  {label: t('Alerts'), to: '/alerts/', icon: <IconSiren />},
  NAV_DIVIDER,
  {label: t('Help'), to: '', icon: <IconQuestion />},
  {label: t('New'), to: '', icon: <IconBroadcast />},
  {label: t('Stats'), to: '', icon: <IconStats />},
  {label: t('Settings'), to: '/settings/organization/', icon: <IconSettings />},
];

function Nav() {
  const organization = useOrganization();
  const location = useLocation();

  const [body, footer] = splitAtDivider(items);
  const {submenu = []} = body.find(item => isActive(item, location)) ?? {
    submenu: [],
  };
  const [submenuBody, submenuFooter] = splitAtDivider(submenu);

  return (
    <NavContainer>
      <Sidebar>
        <Sidebar.Header>
          <OrganizationAvatar organization={organization} size={32} />
        </Sidebar.Header>
        <Sidebar.Body>
          {body.map(item => (
            <Sidebar.Item key={item.to} {...item} />
          ))}
        </Sidebar.Body>
        <Sidebar.Footer>
          {footer.map(item => (
            <Sidebar.Item key={item.to} {...item} />
          ))}
        </Sidebar.Footer>
      </Sidebar>
      <AnimatePresence>
        {submenu.length > 0 && (
          <Submenu>
            <Submenu.Body>
              {submenuBody.map(item => (
                <Submenu.Item key={item.to} {...item} />
              ))}
            </Submenu.Body>
            {submenuFooter.length > 0 && (
              <Submenu.Footer>
                {submenuFooter.map(item => (
                  <Submenu.Item key={item.to} {...item} />
                ))}
              </Submenu.Footer>
            )}
          </Submenu>
        )}
      </AnimatePresence>
    </NavContainer>
  );
}

const NavContainer = styled('nav')`
  position: sticky;
  top: 0;
  bottom: 0;
  height: 100vh;
  height: 100dvh;
  display: flex;
`;

export default Nav;
