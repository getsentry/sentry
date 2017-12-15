import {t} from '../../../locale';

const pathPrefix = '/settings/account';

const accountNavigation = [
  {
    name: t('Personal'),
    items: [
      {
        path: `${pathPrefix}/notifications/`,
        title: t('Notifications'),
      },
      {
        path: `${pathPrefix}/emails/`,
        title: t('Emails'),
      },
    ],
  },
];

export default accountNavigation;
