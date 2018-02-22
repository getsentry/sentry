import React from 'react';
import {t, tct} from '../../locale';
import ExternalLink from '../../components/externalLink';

// Export route to make these forms searchable by label/help
export const route = '/settings/organization/:orgId/project/:projectId/filters/';

const newLine = t('Separate multiple entries with a newline. ');
const newLineAndGlob = `${newLine} ${tct(
  'Separate multiple entries with a newline. Allows [link:glob pattern matching].',
  {
    link: <ExternalLink href="https://en.wikipedia.org/wiki/Glob_(programming)" />,
  }
)}`;
const getOptionsData = data => ({
  options: data,
});

const formGroups = [
  {
    // Form "section"/"panel"
    title: t('Custom Filters'),
    fields: [
      {
        name: 'filters:blacklisted_ips',
        type: 'string',
        multiline: true,

        placeholder: 'e.g. 127.0.0.1 or 10.0.0.0/8',
        label: t('IP Addresses'),
        help: t('Filter events from these IP addresses'),
        extraHelp: newLine,
        getData: getOptionsData,
      },
    ],
  },
];

export default formGroups;

// These require a feature flag
export const customFilterFields = [
  {
    name: 'filters:releases',
    type: 'string',
    multiline: true,

    placeholder: 'e.g. 1.* or [!3].[0-9].*',
    label: t('Releases'),
    help: t('Filter events from these releases'),
    extraHelp: newLineAndGlob,
    getData: getOptionsData,
  },

  {
    name: 'filters:error_messages',
    type: 'string',
    multiline: true,

    placeholder: 'e.g. TypeError* or *: integer division or modulo by zero',
    label: t('Error Message'),
    help: t('Filter events by error messages'),
    extraHelp: newLineAndGlob,
    getData: getOptionsData,
  },
];
