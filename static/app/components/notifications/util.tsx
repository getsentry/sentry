import type {ColorConfig} from 'sentry/components/timeline';
import {IconFire, IconLightning, IconLock, IconStar, IconSubscribed} from 'sentry/icons';
import {type NotificationHistory, NotificationType} from 'sentry/types/notifications';

export function getNotificationData(source: NotificationHistory['source']): {
  colorConfig: ColorConfig;
  icon: React.ReactNode;
} {
  switch (source) {
    case NotificationType.DEPLOY:
      return {
        icon: <IconLightning size="xs" />,
        colorConfig: {title: 'pink400', icon: 'pink400', iconBorder: 'pink200'},
      };
    case NotificationType.ISSUE_ALERTS:
      return {
        icon: <IconFire size="xs" />,
        colorConfig: {title: 'red400', icon: 'red400', iconBorder: 'red200'},
      };
    case NotificationType.WORKFLOW:
      return {
        icon: <IconSubscribed size="xs" />,
        colorConfig: {title: 'green400', icon: 'green400', iconBorder: 'green200'},
      };
    case NotificationType.APPROVAL:
      return {
        icon: <IconLock size="xs" />,
        colorConfig: {title: 'blue400', icon: 'blue300', iconBorder: 'blue200'},
      };
    case NotificationType.MARKETING:
      return {
        icon: <IconStar size="xs" isSolid={false} />,
        colorConfig: {title: 'purple400', icon: 'purple400', iconBorder: 'purple200'},
      };
    default:
      return {
        icon: <IconSubscribed size="xs" />,
        colorConfig: {title: 'gray400', icon: 'gray300', iconBorder: 'gray200'},
      };
  }
}
