import {Fragment} from 'react';
import styled from '@emotion/styled';

import {DrawerBody, DrawerHeader} from 'sentry/components/globalDrawer/components';
import {NotificationItem} from 'sentry/components/notifications/notificationItem';
import {useUserInAppNotifications} from 'sentry/components/notifications/useUserInAppNotifications';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';

interface NotificationCentreProps {}

export function NotificationCentre({}: NotificationCentreProps) {
  const {data: notifs = []} = useUserInAppNotifications();
  return (
    <Fragment>
      <DrawerHeader>{t('Notification Centre')}</DrawerHeader>
      <DrawerBody>
        <NotificationContainer>
          {notifs.map(notification => (
            <NotificationItem key={notification.id} notification={notification} />
          ))}
        </NotificationContainer>
      </DrawerBody>
    </Fragment>
  );
}

const NotificationContainer = styled('div')`
  padding: 0 ${space(1)};
`;
