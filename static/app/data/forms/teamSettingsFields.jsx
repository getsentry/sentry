import React from 'react';

import {t, tct} from 'app/locale';
import slugify from 'app/utils/slugify';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/teams/:teamId/settings/';

const formGroups = [
  {
    // Form "section"/"panel"
    title: 'Team Settings',
    fields: [
      {
        name: 'slug',
        type: 'string',
        required: true,
        label: t('Name'),
        placeholder: 'e.g. api-team',
        help: t('A unique ID used to identify the team'),
        disabled: ({access}) => !access.has('team:write'),
        transformInput: slugify,

        saveOnBlur: false,
        saveMessageAlertType: 'info',
        saveMessage: t('You will be redirected to the new team slug after saving'),
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        label: t('Legacy Name'),
        placeholder: 'e.g. API Team',
        disabled: ({access}) => !access.has('team:write'),
        help: tct(
          '[Deprecated] In the future, only [Name] will be used to identify your team',
          {
            Deprecated: <strong>DEPRECATED</strong>,
            Name: <strong>Name</strong>,
          }
        ),
      },
    ],
  },
];

export default formGroups;
