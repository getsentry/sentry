import {useSyncExternalStore} from 'react';

const supportsNotifications = 'Notification' in window;
const supportsPermissions = 'permissions' in navigator;

const listeners = new Set<() => void>();

let permissionStatus: PermissionStatus | undefined;
let queryPromise: Promise<void> | undefined;

function emitChange() {
  for (const listener of listeners) {
    listener();
  }
}

// Lazily query the permission status once and share it across all subscribers.
// The `change` listener is attached a single time regardless of how many
// components use the hook.
function ensurePermissionStatus() {
  if (!supportsPermissions || queryPromise) {
    return;
  }

  queryPromise = navigator.permissions
    .query({name: 'notifications'})
    .then(status => {
      // Everyone unsubscribed before the query resolved; drop it so the next
      // subscriber starts a fresh query.
      if (listeners.size === 0) {
        queryPromise = undefined;
        return;
      }
      permissionStatus = status;
      permissionStatus.addEventListener('change', emitChange);
      // Sync in case the permission changed while the query was in flight.
      emitChange();
    })
    .catch(() => {
      // Some browsers reject `query` for the 'notifications' name. In that
      // case we silently fall back to reading `Notification.permission`.
      queryPromise = undefined;
    });
}

function subscribe(onStoreChange: () => void) {
  listeners.add(onStoreChange);
  ensurePermissionStatus();

  return () => {
    listeners.delete(onStoreChange);
    if (listeners.size === 0 && permissionStatus) {
      permissionStatus.removeEventListener('change', emitChange);
      permissionStatus = undefined;
      queryPromise = undefined;
    }
  };
}

function getSnapshot(): NotificationPermission {
  return supportsNotifications ? Notification.permission : 'default';
}

// Not every browser fires a `change` event after `requestPermission`, so we
// emit manually to force subscribers to re-read the snapshot.
function askNotificationPermission() {
  if (!supportsNotifications) {
    return Promise.reject(new Error('Notifications are not supported'));
  }
  return Notification.requestPermission().then(emitChange);
}

export function useNotificationPermission() {
  const permission = useSyncExternalStore(subscribe, getSnapshot);
  return {permission, supportsNotifications, askNotificationPermission};
}
