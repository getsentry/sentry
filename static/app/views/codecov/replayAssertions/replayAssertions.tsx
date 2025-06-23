import {space} from 'sentry/styles/space';
import useLoadReplayReader from 'sentry/utils/replays/hooks/useLoadReplayReader';

import {getFlowDefinition} from './flowDefinitions/flowDefinitions';
import {getFlow} from './flows/flows';

export default function ReplayAssertionsPage() {
  const flowDefinition = getFlowDefinition('flowDefintion1');

  const flow = getFlow('flow1');

  const replaySlug = 'acd5d72f6ba54385ac80abe9dfadb142';
  const orgSlug = 'codecov';

  const readerResult = useLoadReplayReader({
    replaySlug,
    orgSlug,
  });

  const {replay, replayRecord} = readerResult;

  console.log({replay});
  console.log({replayRecord});

  return (
    <div>
      <div style={{display: 'flex', gap: space(2)}}>
        <div style={{flex: 1}}>
          <h3>Flow Definition</h3>
          <pre>{JSON.stringify(flowDefinition, null, 2)}</pre>
        </div>
        <div style={{flex: 1}}>
          <h3>Flow</h3>
          <pre>{JSON.stringify(flow, null, 2)}</pre>
        </div>
      </div>
    </div>
  );
}
