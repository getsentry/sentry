import {useCallback, useState} from 'react';

export function useNotificationPermission() {
  const supportsNotifications = 'Notification' in window;

  const [permission, setPermission] = useState<NotificationPermission>(
    supportsNotifications ? Notification.permission : 'default'
  );

  const askNotificationPermission = useCallback(() => {
    if (!supportsNotifications) {
      return;
    }
    Notification.requestPermission().then(setPermission);
  }, [supportsNotifications]);

  return {permission, supportsNotifications, askNotificationPermission};
}
