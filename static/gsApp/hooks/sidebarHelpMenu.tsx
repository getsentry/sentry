import SidebarMenuItem from 'sentry/components/sidebar/sidebarMenuItem';
import {t} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import withOrganization from 'sentry/utils/withOrganization';

import ZendeskLink from 'getsentry/components/zendeskLink';

type Props = {
  organization: Organization;
};

function SupportLink({organization}: Props) {
  return (
    <ZendeskLink
      source="help_sidebar"
      organization={organization}
      Component={({href, onClick}) => (
        <SidebarMenuItem openInNewTab={false} href={href} onClick={e => onClick(e)}>
          {t('Contact Support')}
        </SidebarMenuItem>
      )}
    />
  );
}

const SidebarHelpMenu = withOrganization(SupportLink);
const hookSidebarHelpMenu = <T extends Record<PropertyKey, unknown>>(props: T) => (
  <SidebarHelpMenu key="sidebar:help-menu" {...props} />
);

export default hookSidebarHelpMenu;
