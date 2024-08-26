import {useEffect, useState} from 'react';
import styled from '@emotion/styled';
import {motion} from 'framer-motion';

import GuideAnchor from 'sentry/components/assistant/guideAnchor';
import useDrawer from 'sentry/components/globalDrawer';
import {NotificationCentre} from 'sentry/components/notifications/notificationCentre';
import {useUserInAppNotifications} from 'sentry/components/notifications/useUserInAppNotifications';
import {SidebarSection} from 'sentry/components/sidebar';
import SidebarItem, {type SidebarItemProps} from 'sentry/components/sidebar/sidebarItem';
import {IconSubscribed} from 'sentry/icons';
import {tn} from 'sentry/locale';
import {NotificationHistoryStatus} from 'sentry/types/notifications';

export function NotificationSidebar({
  ...props
}: Omit<SidebarItemProps, 'icon' | 'label' | 'id'>) {
  const {openDrawer} = useDrawer();
  const [trigger, setTrigger] = useState<HTMLDivElement | null>(null);
  const {data: notifs = []} = useUserInAppNotifications();
  const [notifData, setNotifData] = useState({
    unreadCount: 0,
    notifCount: 0,
  });

  const [isNotifying, setIsNotifying] = useState(false);

  useEffect(() => {
    // XXX(Leander): Super doesn't work with pagination, but for hackweek, lets ignore that.
    const newNotifCount = notifs.length;
    const newUnreadCount = notifs.filter(
      n => n.status === NotificationHistoryStatus.UNREAD
    ).length;
    if (newNotifCount > notifData.notifCount && newUnreadCount > notifData.unreadCount) {
      setIsNotifying(true);
    }
    setNotifData({
      unreadCount: newUnreadCount,
      notifCount: newNotifCount,
    });
  }, [notifs, notifData.notifCount, notifData.unreadCount]);

  return (
    <SidebarSection ref={setTrigger}>
      <ItemWrapper isNotifying={isNotifying}>
        <SidebarItem
          {...props}
          id="notifications"
          icon={
            <IconWrapper
              animate={{
                rotate: isNotifying ? [null, 30, -30, 45, -45, 30, -30, 0] : [],
              }}
              transition={{
                ease: 'easeInOut',
                duration: 1,
                repeat: 1,
              }}
              onAnimationComplete={() => {
                setIsNotifying(false);
              }}
            >
              <IconSubscribed />
            </IconWrapper>
          }
          label={
            <GuideAnchor target="notifications">
              {notifData.unreadCount > 0 ? notifData.unreadCount : null}
              {tn(' Notification', ' Notifications', notifData.unreadCount)}
            </GuideAnchor>
          }
          onClick={() =>
            openDrawer(() => <NotificationCentre />, {
              ariaLabel: 'notification-centre',
              shouldCloseOnInteractOutside: element => !trigger?.contains(element),
            })
          }
        />
      </ItemWrapper>
    </SidebarSection>
  );
}

const IconWrapper = styled(motion.div)``;

const ItemWrapper = styled('div')<{isNotifying: boolean}>`
  transition: all 0.2s ease-in-out;
  border-radius: ${p => p.theme.borderRadius};
  background: ${p => (p.isNotifying ? p.theme.purple200 : 'transparent')};
  color: ${p => (p.isNotifying ? p.theme.white : 'inherit')};
`;
