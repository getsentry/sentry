import MutedBox from 'sentry/components/mutedBox';
import ResolutionBox from 'sentry/components/resolutionBox';

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
  title: 'Features/Issues/Resolution Box & Muted Box',
};

export const ResolvedStates = () => (
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
);

ResolvedStates.storyName = 'Resolved States';

export const MutedStates = () => (
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
);

MutedStates.storyName = 'Muted States';
