import {t} from 'sentry/locale';
import HookStore from 'sentry/stores/hookStore';
import {Organization} from 'sentry/types';
import {NavigationSection} from 'sentry/views/settings/types';

const pathPrefix = '/settings/account';

type ConfigParams = {
  organization?: Organization;
};

function getConfiguration({organization}: ConfigParams): NavigationSection[] {
  return [
    {
      name: t('Account'),
      items: [
        {
          path: `${pathPrefix}/details/`,
          title: t('Account Details'),
          description: t(
            'Change your account details and preferences (e.g. timezone/clock, avatar, language)'
          ),
        },
        {
          path: `${pathPrefix}/security/`,
          title: t('Security'),
          description: t('Change your account password and/or two factor authentication'),
        },
        {
          path: `${pathPrefix}/notifications/`,
          title: t('Notifications'),
          description: t('Configure what email notifications to receive'),
        },
        {
          path: `${pathPrefix}/emails/`,
          title: t('Email Addresses'),
          description: t(
            'Add or remove secondary emails, change your primary email, verify your emails'
          ),
        },
        {
          path: `${pathPrefix}/subscriptions/`,
          title: t('Subscriptions'),
          description: t(
            'Change Sentry marketing subscriptions you are subscribed to (GDPR)'
          ),
        },
        {
          path: `${pathPrefix}/authorizations/`,
          title: t('Authorized Applications'),
          description: t(
            'Manage third-party applications that have access to your Sentry account'
          ),
        },
        {
          path: `${pathPrefix}/identities/`,
          title: t('Identities'),
          description: t(
            'Manage your third-party identities that are associated to Sentry'
          ),
        },
        {
          path: `${pathPrefix}/close-account/`,
          title: t('Close Account'),
          description: t('Permanently close your Sentry account'),
        },
      ],
    },
    {
      name: t('API'),
      items: [
        {
          path: `${pathPrefix}/api/applications/`,
          title: t('Applications'),
          description: t('Add and configure OAuth2 applications'),
        },
        {
          path: `${pathPrefix}/api/auth-tokens/`,
          title: t('User Auth Tokens'),
          description: t(
            "Authentication tokens allow you to perform actions against the Sentry API on behalf of your account. They're the easiest way to get started using the API."
          ),
        },
        ...HookStore.get('settings:api-navigation-config').flatMap(cb =>
          cb(organization)
        ),
      ],
    },
  ];
}

export default getConfiguration;
