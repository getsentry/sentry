import React from 'react';
import {withInfo} from '@storybook/addon-info';

import ResolutionBox from 'app/components/resolutionBox';
import MutedBox from 'app/components/mutedBox';

const actor = {
  email: 'uhoh@example.com',
  name: 'Uhoh',
};
const RESOLVED_IN_COMMIT = {
  actor,
  inCommit: {
    id: 'deadbeefdeadface',
    repository: {
      name: 'getsentry/sentry',
      provider: {
        id: 'github',
      },
    },
    dateCreated: '2020-07-01 12:13:14',
  },
};

export default {
  title: 'Issues/ResolutionBox & MutedBox',
};

export const ResolvedStates = withInfo('Basic resolution & resolved by commit')(() => (
  <div>
    <div className="section">
      <h3>Basic resolution</h3>
      <ResolutionBox projectId="1" statusDetails={{}} />
    </div>

    <div className="section">
      <h3>Commit resolution</h3>
      <ResolutionBox projectId="1" statusDetails={RESOLVED_IN_COMMIT} />
    </div>

    <div className="section">
      <h3>Release resolution</h3>
      <ResolutionBox projectId="1" statusDetails={{inRelease: '20.07', actor}} />
    </div>

    <div className="section">
      <h3>Next Release resolution</h3>
      <ResolutionBox projectId="1" statusDetails={{inNextRelease: true, actor}} />
    </div>
  </div>
));

ResolvedStates.story = {
  name: 'resolved states',
};

export const MutedStates = withInfo('Various mute modes')(() => (
  <div>
    <div className="section">
      <h3>Basic mute</h3>
      <MutedBox statusDetails={{}} />
    </div>

    <div className="section">
      <h3>Mute Until</h3>
      <MutedBox statusDetails={{ignoreUntil: '2020-07-01 12:13:14'}} />
    </div>

    <div className="section">
      <h3>Mute count</h3>
      <MutedBox statusDetails={{ignoreCount: 10}} />
    </div>

    <div className="section">
      <h3>Mute count with window</h3>
      <MutedBox statusDetails={{ignoreCount: 10, ignoreWindow: 5}} />
    </div>

    <div className="section">
      <h3>Mute user count</h3>
      <MutedBox statusDetails={{ignoreUserCount: 10}} />
    </div>

    <div className="section">
      <h3>Mute user count with window</h3>
      <MutedBox statusDetails={{ignoreUserCount: 10, ignoreUserWindow: 5}} />
    </div>
  </div>
));

MutedStates.story = {
  name: 'muted states',
};
