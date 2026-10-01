import {Stack} from '@sentry/scraps/layout';

import {ProgressState} from 'sentry/types/group';

import {formatProgressState, getProgressIcon} from './progress';

const states = [
  ProgressState.IDENTIFIED,
  ProgressState.ASSIGNED,
  ProgressState.DIAGNOSED,
  ProgressState.FIX_PROPOSED,
  ProgressState.FIX_APPLIED,
];

describe('ProgressState', () => {
  it.snapshot.each(states)(
    '%s',
    state => (
      <div style={{padding: 8}}>
        <Stack direction="row" align="center" gap="sm">
          {getProgressIcon(state)}
          {formatProgressState(state)}
        </Stack>
      </div>
    ),
    state => ({tags: {area: 'core', state: String(state)}})
  );
});
