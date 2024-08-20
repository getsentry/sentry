import {useState} from 'react';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import useDrawer from 'sentry/components/globalDrawer';
import {NotificationCentre} from 'sentry/components/notifications/notificationCentre';
import {SidebarSection} from 'sentry/components/sidebar';
import SidebarItem, {type SidebarItemProps} from 'sentry/components/sidebar/sidebarItem';
import {IconSubscribed} from 'sentry/icons';
import {t} from 'sentry/locale';

export function NotificationSidebar({
  ...props
}: Omit<SidebarItemProps, 'icon' | 'label' | 'id'>) {
  const {openDrawer} = useDrawer();
  const [trigger, setTrigger] = useState<HTMLDivElement | null>(null);
  return (
    <SidebarSection ref={setTrigger}>
      <SidebarItem
        {...props}
        id="notifications"
        icon={<IconSubscribed />}
        label={
          <GuideAnchor target="notifications">
            {2} {t('Notifications')}
          </GuideAnchor>
        }
        onClick={() =>
          openDrawer(() => <NotificationCentre />, {
            ariaLabel: 'notification-centre',
            shouldCloseOnInteractOutside: element => !trigger?.contains(element),
          })
        }
      />
    </SidebarSection>
  );
}
