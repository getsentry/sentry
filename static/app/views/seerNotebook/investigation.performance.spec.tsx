import {Profiler, useState, type ProfilerOnRenderCallback} from 'react';
import {
  InvestigationCellFixture,
  InvestigationDetailFixture,
} from 'sentry-fixture/investigation';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  act,
  fireEvent,
  render,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {TopBar} from 'sentry/views/navigation/topBar';
import {SeerInvestigationPerformanceHarness} from 'sentry/views/seerNotebook/investigation';

type ProfileCommit = {
  actualDuration: number;
  baseDuration: number;
  phase: 'mount' | 'nested-update' | 'update';
};

function summarize(commits: ProfileCommit[]) {
  return {
    commits: commits.length,
    phases: commits.reduce<Record<string, number>>((counts, commit) => {
      counts[commit.phase] = (counts[commit.phase] ?? 0) + 1;
      return counts;
    }, {}),
    maxActualDuration: Math.max(0, ...commits.map(commit => commit.actualDuration)),
    totalActualDuration: commits.reduce(
      (total, commit) => total + commit.actualDuration,
      0
    ),
    totalBaseDuration: commits.reduce((total, commit) => total + commit.baseDuration, 0),
  };
}

function ControlledTextArea() {
  const [value, setValue] = useState('Paragraph 0');
  return (
    <textarea
      aria-label="Control editor"
      value={value}
      onChange={event => setValue(event.target.value)}
    />
  );
}

describe('SeerInvestigation performance', () => {
  const organization = OrganizationFixture({features: ['investigations']});
  const cells = Array.from({length: 40}, (_, index) =>
    InvestigationCellFixture({
      id: `cell-${index}`,
      position: index,
      content: `Paragraph ${index}`,
    })
  );
  const detail = InvestigationDetailFixture({cells});
  const detailUrl = `/organizations/${organization.slug}/investigations/${detail.id}/`;

  beforeEach(() => {
    act(() =>
      ProjectsStore.loadInitialData([ProjectFixture({id: '1', slug: 'frontend'})])
    );
    MockApiClient.addMockResponse({url: detailUrl, body: detail});
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [MemberFixture({id: '1', name: 'Test User'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/projects/`,
      body: [ProjectFixture({id: '1', slug: 'frontend'})],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/releases/`,
      body: [],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/${cells[0]!.id}/`,
      method: 'PUT',
      body: {
        ...cells[0],
        content: `${cells[0]!.content}abcdefghijklmnopqrst`,
        version: 2,
      },
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/`,
      method: 'POST',
      body: InvestigationCellFixture({
        id: 'cell-40',
        position: 40,
        content: '',
        version: 1,
      }),
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${detail.id}/cells/order/`,
      method: 'PUT',
      body: {
        ...detail,
        version: detail.version + 1,
        cells: [cells[1]!, cells[0]!, ...cells.slice(2)],
      },
    });
  });

  afterEach(() => PageFiltersStore.reset());

  it('calibrates the profiler harness with a controlled textarea', () => {
    const commits: ProfileCommit[] = [];
    const onRender: ProfilerOnRenderCallback = (
      _id,
      phase,
      actualDuration,
      baseDuration
    ) => commits.push({phase, actualDuration, baseDuration});
    render(
      <Profiler id="control" onRender={onRender}>
        <ControlledTextArea />
      </Profiler>
    );
    commits.length = 0;
    const editor = screen.getByRole('textbox', {name: 'Control editor'});
    let value = 'Paragraph 0';
    for (const character of 'abcdefghijklmnopqrst') {
      value += character;
      fireEvent.change(editor, {target: {value}});
    }

    expect(summarize(commits).commits).toBe(20);
  });

  it('tracks large-notebook render and typing costs', async () => {
    const commits: ProfileCommit[] = [];
    const cellListCommits: ProfileCommit[] = [];
    const onRender: ProfilerOnRenderCallback = (
      _id,
      phase,
      actualDuration,
      baseDuration
    ) => {
      commits.push({phase, actualDuration, baseDuration});
    };
    const onCellListRender: ProfilerOnRenderCallback = (
      _id,
      phase,
      actualDuration,
      baseDuration
    ) => {
      cellListCommits.push({phase, actualDuration, baseDuration});
    };

    const view = render(
      <Profiler id="investigation" onRender={onRender}>
        <TopBar.Slot.Provider>
          <TopBar />
          <SeerInvestigationPerformanceHarness onCellListRender={onCellListRender} />
        </TopBar.Slot.Provider>
      </Profiler>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/organizations/${organization.slug}/seer/${detail.id}/`},
          route: '/organizations/:orgId/seer/:investigationId/',
        },
      }
    );

    await screen.findByText('Paragraph 39');
    const initialRender = summarize(commits);
    const initialCellListRender = summarize(cellListCommits);

    jest.useFakeTimers();
    fireEvent.click(screen.getByText('Paragraph 0'));
    const editor = screen.getByRole('textbox', {name: 'Text cell 1'});
    commits.length = 0;
    cellListCommits.length = 0;
    let value = cells[0]!.content;
    for (const character of 'abcdefghijklmnopqrst') {
      value += character;
      fireEvent.change(editor, {target: {value}});
    }
    const typing = summarize(commits);
    const typingCellList = summarize(cellListCommits);

    commits.length = 0;
    cellListCommits.length = 0;
    await act(async () => {
      jest.advanceTimersByTime(600);
      await Promise.resolve();
      await Promise.resolve();
    });
    const autosave = summarize(commits);
    const autosaveCellList = summarize(cellListCommits);

    view.unmount();
    jest.clearAllTimers();
    jest.useRealTimers();

    if (process.env.SENTRY_PERF_LOG) {
      // eslint-disable-next-line no-console
      console.info(
        'SEER_NOTEBOOK_PERF',
        JSON.stringify({
          initialRender,
          initialCellListRender,
          typing,
          typingCellList,
          autosave,
          autosaveCellList,
        })
      );
    }

    expect(typing.commits).toBeLessThanOrEqual(20);
    expect(typingCellList.commits).toBeLessThanOrEqual(20);
    expect(autosave.commits).toBeLessThanOrEqual(3);
    expect(autosaveCellList.commits).toBeLessThanOrEqual(1);
  });

  it('tracks optimistic insertion cost in a large notebook', async () => {
    const commits: ProfileCommit[] = [];
    const cellListCommits: ProfileCommit[] = [];
    const onRender: ProfilerOnRenderCallback = (
      _id,
      phase,
      actualDuration,
      baseDuration
    ) => commits.push({phase, actualDuration, baseDuration});
    const onCellListRender: ProfilerOnRenderCallback = (
      _id,
      phase,
      actualDuration,
      baseDuration
    ) => cellListCommits.push({phase, actualDuration, baseDuration});

    render(
      <Profiler id="investigation" onRender={onRender}>
        <TopBar.Slot.Provider>
          <TopBar />
          <SeerInvestigationPerformanceHarness onCellListRender={onCellListRender} />
        </TopBar.Slot.Provider>
      </Profiler>,
      {
        organization,
        initialRouterConfig: {
          location: {pathname: `/organizations/${organization.slug}/seer/${detail.id}/`},
          route: '/organizations/:orgId/seer/:investigationId/',
        },
      }
    );

    await screen.findByText('Paragraph 39');
    const initialCellListRender = summarize(cellListCommits);
    const articles = document.querySelectorAll('article');
    expect(articles).toHaveLength(40);
    articles.forEach((article, index) => {
      article.getBoundingClientRect = () => ({
        bottom: index * 100 + 80,
        height: 80,
        left: 0,
        right: 800,
        top: index * 100,
        width: 800,
        x: 0,
        y: index * 100,
        toJSON: () => {},
      });
    });

    const firstDragHandle = screen.getAllByRole('button', {
      name: 'Drag to reorder',
    })[0]!;
    commits.length = 0;
    cellListCommits.length = 0;
    fireEvent(firstDragHandle, makePointerEvent('pointerdown', 10));
    fireEvent(document, makePointerEvent('pointermove', 20));
    await waitForDndAnnouncement('was moved over');
    commits.length = 0;
    cellListCommits.length = 0;
    fireEvent(document, makePointerEvent('pointermove', 130));
    await waitForDndAnnouncement('cell-1');
    const dragOver = summarize(commits);
    const dragOverCellList = summarize(cellListCommits);
    fireEvent(document, makePointerEvent('pointerup', 130));
    await act(async () => Promise.resolve());
    commits.length = 0;
    cellListCommits.length = 0;

    await userEvent.click(screen.getByRole('button', {name: 'Add cell'}));
    const openMenu = summarize(commits);
    const openMenuCellList = summarize(cellListCommits);
    commits.length = 0;
    cellListCommits.length = 0;
    await userEvent.click(screen.getByRole('menuitemradio', {name: 'Text'}));
    await screen.findByRole('textbox', {name: 'Text cell 41'});

    const insertion = summarize(commits);
    const insertionCellList = summarize(cellListCommits);
    if (process.env.SENTRY_PERF_LOG) {
      // eslint-disable-next-line no-console
      console.info(
        'SEER_NOTEBOOK_INSERT_PERF',
        JSON.stringify({
          initialCellListRender,
          dragOver,
          dragOverCellList,
          openMenu,
          openMenuCellList,
          insertion,
          insertionCellList,
        })
      );
    }

    expect(dragOver.commits).toBeLessThanOrEqual(2);
    expect(dragOverCellList.commits).toBeLessThanOrEqual(2);
    expect(openMenu.commits).toBeLessThanOrEqual(9);
    expect(insertion.commits).toBeLessThanOrEqual(8);
    expect(insertionCellList.commits).toBeLessThanOrEqual(3);
  });
});

async function waitForDndAnnouncement(text: string) {
  await waitFor(() =>
    expect(document.querySelector('[id^="DndLiveRegion"]')).toHaveTextContent(text)
  );
}

function makePointerEvent(type: string, clientY: number) {
  const event = new Event(type, {bubbles: true, cancelable: true});
  Object.defineProperties(event, {
    button: {value: 0},
    clientX: {value: 10},
    clientY: {value: clientY},
    isPrimary: {value: true},
    pointerId: {value: 1},
  });
  return event;
}
