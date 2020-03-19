import React from 'react';

import {t, tct} from 'app/locale';
import ExternalLink from 'app/components/links/externalLink';
import {JsonFormObject, Field} from 'app/views/settings/components/forms/type';

// Export route to make these forms searchable by label/help
export const route = '/settings/:orgId/projects/:projectId/filters/';

const newLineHelpText = t('Separate multiple entries with a newline.');
const globHelpText = tct('Allows [link:glob pattern matching].', {
  link: <ExternalLink href="https://en.wikipedia.org/wiki/Glob_(programming)" />,
});

const getOptionsData = (data: object) => ({options: data});

const formGroups: JsonFormObject[] = [
  {
    // Form "section"/"panel"
    title: t('Custom Filters'),
    fields: [
      {
        name: 'filters:blacklisted_ips',
        type: 'string',
        multiline: true,
        autosize: true,
        maxRows: 10,

        placeholder: 'e.g. 127.0.0.1 or 10.0.0.0/8',
        label: t('IP Addresses'),
        help: (
          <React.Fragment>
            {t('Filter events from these IP addresses. ')}
            {newLineHelpText}
          </React.Fragment>
        ),
        getData: getOptionsData,
      },
    ],
  },
];

export default formGroups;

// These require a feature flag
export const customFilterFields: Field[] = [
  {
    name: 'filters:releases',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,

    placeholder: 'e.g. 1.* or [!3].[0-9].*',
    label: t('Releases'),
    help: (
      <React.Fragment>
        {t('Filter events from these releases. ')}
        {newLineHelpText} {globHelpText}
      </React.Fragment>
    ),
    getData: getOptionsData,
  },

  {
    name: 'filters:error_messages',
    type: 'string',
    multiline: true,
    autosize: true,
    maxRows: 10,

    placeholder: 'e.g. TypeError* or *: integer division or modulo by zero',
    label: t('Error Message'),
    help: (
      <React.Fragment>
        {t('Filter events by error messages. ')}
        {newLineHelpText} {globHelpText}
      </React.Fragment>
    ),
    getData: getOptionsData,
  },
];
