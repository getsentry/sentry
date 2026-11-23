import {ReplayListFixture} from 'sentry-fixture/replayList';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';
import {SeerSelectionToggle} from 'sentry/views/seerExplorer/components/seerSelectionToggle';
import {SeerSelectionProvider} from 'sentry/views/seerExplorer/contexts/seerSelection';

import {ReplaySelectionSeerContext} from './replaySelectionSeerContext';

const replays = ReplayListFixture();

function SelectionButtons() {
  const {toggleSelected} = useListItemCheckboxContext();
  return (
    <button onClick={() => toggleSelected(replays[0]!.id)}>select first replay</button>
  );
}

describe('ReplaySelectionSeerContext', () => {
  it('reports the selected replays to the Seer composer', async () => {
    render(
      <SeerSelectionProvider>
        <ListItemCheckboxProvider
          hits={replays.length}
          knownIds={replays.map(replay => replay.id)}
          endpointOptions={undefined}
        >
          <ReplaySelectionSeerContext replays={replays} />
          <SelectionButtons />
        </ListItemCheckboxProvider>
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(screen.queryByRole('button', {name: /in context/})).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select first replay'}));
    expect(
      await screen.findByRole('button', {name: 'Include 1 replay in context'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select first replay'}));
    expect(screen.queryByRole('button', {name: /in context/})).not.toBeInTheDocument();
  });
});
