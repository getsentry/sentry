import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';
import {ReplayListFixture} from 'sentry-fixture/replayList';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import type {BaseGroup} from 'sentry/types/group';
import {
  ListItemCheckboxProvider,
  useListItemCheckboxContext,
} from 'sentry/utils/list/useListItemCheckboxState';
import type {ReplayListRecord} from 'sentry/views/explore/replays/types';
import {
  IssueSelectionProvider,
  useIssueSelectionActions,
} from 'sentry/views/issueList/issueSelectionContext';
import {SeerSelectionToggle} from 'sentry/views/seerExplorer/components/seerSelectionToggle';

import type {LLMContextSnapshot} from './llmContextTypes';
import {
  SeerSelectionProvider,
  useAddSeerSelectionToSnapshot,
  useSeerTableSelection,
} from './seerSelection';

const replays = ReplayListFixture();
const replayToSummary = (replay: ReplayListRecord) => ({id: replay.id});

const project = ProjectFixture();
const groups = [
  GroupFixture({id: '1', shortId: 'PROJ-1', project}),
  GroupFixture({id: '2', shortId: 'PROJ-2', project}),
  GroupFixture({id: '3', shortId: 'PROJ-3', project}),
];
const issueToSummary = (group: BaseGroup) => ({shortId: group.shortId});

const EMPTY_SNAPSHOT: LLMContextSnapshot = {version: 1, nodes: []};

function SelectFirstReplay() {
  const {toggleSelected} = useListItemCheckboxContext();
  return (
    <button onClick={() => toggleSelected(replays[0]!.id)}>select first replay</button>
  );
}

function IssueSelectionButtons() {
  const {toggleSelect, setAllInQuerySelected, toggleSelectAllVisible} =
    useIssueSelectionActions();
  return (
    <div>
      <button onClick={() => toggleSelect('1')}>select 1</button>
      <button onClick={() => toggleSelect('2')}>select 2</button>
      <button
        onClick={() => {
          toggleSelectAllVisible();
          setAllInQuerySelected(true);
        }}
      >
        select all
      </button>
    </div>
  );
}

describe('Seer table selection', () => {
  it('reports rows selected in a ListItemCheckboxProvider that opts in', async () => {
    render(
      <SeerSelectionProvider>
        <ListItemCheckboxProvider
          hits={replays.length}
          knownIds={replays.map(replay => replay.id)}
          endpointOptions={undefined}
          seerContext={{itemType: 'replay', rows: replays, toSummary: replayToSummary}}
        >
          <SelectFirstReplay />
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

  it('keeps the selection from Seer when the list does not opt in', async () => {
    render(
      <SeerSelectionProvider>
        <ListItemCheckboxProvider
          hits={replays.length}
          knownIds={replays.map(replay => replay.id)}
          endpointOptions={undefined}
        >
          <SelectFirstReplay />
        </ListItemCheckboxProvider>
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    await userEvent.click(screen.getByRole('button', {name: 'select first replay'}));
    expect(screen.queryByRole('button', {name: /in context/})).not.toBeInTheDocument();
  });

  it('reports issues selected in the stream, including every matching issue', async () => {
    render(
      <SeerSelectionProvider>
        <IssueSelectionProvider
          visibleGroupIds={groups.map(group => group.id)}
          seerContext={{
            itemType: 'issue',
            rows: groups,
            toSummary: issueToSummary,
            total: 120,
          }}
        >
          <IssueSelectionButtons />
        </IssueSelectionProvider>
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    await userEvent.click(screen.getByRole('button', {name: 'select 1'}));
    expect(
      await screen.findByRole('button', {name: 'Include 1 issue in context'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select 2'}));
    expect(
      await screen.findByRole('button', {name: 'Include 2 issues in context'})
    ).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', {name: 'select all'}));
    expect(
      await screen.findByRole('button', {name: 'Include 120 issues in context'})
    ).toBeInTheDocument();
  });

  it('sends at most 15 row summaries with the selected count', async () => {
    const rows = Array.from({length: 20}, (_, i) => ({id: String(i)}));
    let snapshot: LLMContextSnapshot | undefined;

    function Table() {
      useSeerTableSelection(
        {itemType: 'monitor', rows, toSummary: row => ({id: row.id})},
        'all'
      );
      return null;
    }
    function Capture() {
      const addSelection = useAddSeerSelectionToSnapshot();
      return (
        <button onClick={() => (snapshot = addSelection(EMPTY_SNAPSHOT))}>capture</button>
      );
    }

    render(
      <SeerSelectionProvider>
        <Table />
        <Capture />
      </SeerSelectionProvider>
    );
    await userEvent.click(screen.getByRole('button', {name: 'capture'}));

    expect(snapshot?.nodes).toEqual([
      expect.objectContaining({
        nodeType: 'selection',
        data: expect.objectContaining({
          itemType: 'monitor',
          selectedCount: 20,
          allSelected: true,
          selectedItems: rows.slice(0, 15),
        }),
      }),
    ]);
  });

  it('keeps counting selected rows the current page no longer shows', async () => {
    let snapshot: LLMContextSnapshot | undefined;

    function Table({
      rows,
      allInQuerySelected,
    }: {
      allInQuerySelected: boolean;
      rows: Array<{id: string}>;
    }) {
      useSeerTableSelection(
        {itemType: 'alert', rows, toSummary: row => ({id: row.id}), total: 40},
        new Set(['1', '2']),
        allInQuerySelected
      );
      return null;
    }
    function Capture() {
      const addSelection = useAddSeerSelectionToSnapshot();
      return (
        <button onClick={() => (snapshot = addSelection(EMPTY_SNAPSHOT))}>capture</button>
      );
    }

    const secondPage = [{id: '3'}, {id: '4'}];
    const {rerender} = render(
      <SeerSelectionProvider>
        <Table rows={secondPage} allInQuerySelected={false} />
        <Capture />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(
      await screen.findByRole('button', {name: 'Include 2 alerts in context'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'capture'}));
    expect(snapshot?.nodes[0]?.data).toEqual(
      expect.objectContaining({selectedCount: 2, selectedItems: []})
    );

    rerender(
      <SeerSelectionProvider>
        <Table rows={secondPage} allInQuerySelected />
        <Capture />
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(
      await screen.findByRole('button', {name: 'Include 40 alerts in context'})
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', {name: 'capture'}));
    expect(snapshot?.nodes[0]?.data).toEqual(
      expect.objectContaining({selectedCount: 40, selectedItems: secondPage})
    );
  });
});
