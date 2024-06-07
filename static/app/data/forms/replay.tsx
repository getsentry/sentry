import type {JsonFormObject} from 'sentry/components/forms/types';
import {t} from 'sentry/locale';

export const route = '/settings/:orgId/projects/:projectId/replays/';

const formGroups: JsonFormObject[] = [
  {
    title: 'Settings',
    fields: [
      {
        name: 'sentry:replay_rage_click_issues',
        type: 'boolean',

        // additional data/props that is related to rendering of form field rather than data
        label: t('Create Rage Click Issues'),
        help: t('Toggles whether or not to create Session Replay Rage Click Issues'),
        getData: data => ({options: data}),
      },
      {
        name: 'sentry:replay_hydration_error_issues',
        type: 'boolean',

        // additional data/props that is related to rendering of form field rather than data
        label: t('Create Hydration Error Issues'),
        help: t('Toggles whether or not to create Session Replay Hydration Error Issues'),
        getData: data => ({options: data}),
        visible({features}) {
          return features.has('session-replay-hydration-error-issue-creation');
        },
      },
    ],
  },
];

export default formGroups;
