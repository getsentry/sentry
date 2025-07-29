import SidebarMenuItem from 'sentry/components/sidebar/sidebarMenuItem';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';

import ZendeskLink from 'getsentry/components/zendeskLink';

function SidebarHelpMenu() {
  const organization = useOrganization();
  return (
    <ZendeskLink
      source="help_sidebar"
      organization={organization}
      Component={({href, onClick}) => (
        <SidebarMenuItem
          openInNewTab={false}
          href={href}
          onClick={e => onClick?.(e as any)}
        >
          {t('Contact Support')}
        </SidebarMenuItem>
      )}
    />
  );
}

const hookSidebarHelpMenu = <T extends Record<PropertyKey, unknown>>(_props: T) => (
  <SidebarHelpMenu key="sidebar:help-menu" />
);

export default hookSidebarHelpMenu;
