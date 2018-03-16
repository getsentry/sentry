import React from 'react';

import {t, tct} from '../../locale';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/teams/:teamId/settings/';

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
      },
      {
        name: 'name',
        type: 'string',
        required: true,
        label: t('Legacy Name'),
        placeholder: 'e.g. API Team',
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
