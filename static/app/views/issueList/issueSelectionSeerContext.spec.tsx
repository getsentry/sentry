import {GroupFixture} from 'sentry-fixture/group';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {SeerSelectionToggle} from 'sentry/views/seerExplorer/components/seerSelectionToggle';
import {SeerSelectionProvider} from 'sentry/views/seerExplorer/contexts/seerSelection';

import {IssueSelectionProvider, useIssueSelectionActions} from './issueSelectionContext';
import {IssueSelectionSeerContext} from './issueSelectionSeerContext';

const project = ProjectFixture();
const groups = [
  GroupFixture({id: '1', shortId: 'PROJ-1', project}),
  GroupFixture({id: '2', shortId: 'PROJ-2', project}),
  GroupFixture({id: '3', shortId: 'PROJ-3', project}),
];

function SelectionButtons() {
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

describe('IssueSelectionSeerContext', () => {
  it('reports the selected issues to the Seer composer', async () => {
    render(
      <SeerSelectionProvider>
        <IssueSelectionProvider visibleGroupIds={groups.map(group => group.id)}>
          <IssueSelectionSeerContext groups={groups} queryCount={120} />
          <SelectionButtons />
        </IssueSelectionProvider>
        <SeerSelectionToggle />
      </SeerSelectionProvider>
    );

    expect(screen.queryByRole('button', {name: /in context/})).not.toBeInTheDocument();

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
});
