import {Field} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/account/notifications/';

export const fields: {[key: string]: Field} = {
  personalActivityNotifications: {
    name: 'personalActivityNotifications',
    type: 'boolean',
    label: t('Notify Me About My Own Activity'),
    help: t('Enable this to receive notifications about your own actions on Sentry.'),
  },
  selfAssignOnResolve: {
    name: 'selfAssignOnResolve',
    type: 'boolean',
    label: t("Claim Unassigned Issues I've Resolved"),
    help: t("You'll receive notifications about any changes that happen afterwards."),
  },
};
