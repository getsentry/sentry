import {Fragment} from 'react';

import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {useUserInAppNotifications} from 'sentry/components/notifications/useUserInAppNotifications';
import Timeline from 'sentry/components/timeline';
import {IconSubscribed} from 'sentry/icons';
import {t} from 'sentry/locale';

interface NotificationCentreProps {}

export function NotificationCentre({}: NotificationCentreProps) {
  const {data: notifs = []} = useUserInAppNotifications();

  return (
    <Fragment>
      <DrawerHeader>{t('Notification Centre')}</DrawerHeader>
      <DrawerBody>
        <Timeline.Container>
          {notifs.map(notif => (
            <Timeline.Item icon={<IconSubscribed />} title="Notification" key={notif.id}>
              {JSON.stringify(notif)}
            </Timeline.Item>
          ))}
        </Timeline.Container>
      </DrawerBody>
    </Fragment>
  );
}
