import {useEffect} from 'react';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';
import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, waitFor} from 'sentry-test/reactTestingLibrary';

import {PageFiltersStore} from 'sentry/components/pageFilters/store';
import {ContinuousFlamegraphContextMenu} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import type {FlamegraphFrame} from 'sentry/utils/profiling/flamegraphFrame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';

const project = ProjectFixture({id: '6178942', slug: 'seer', platform: 'python-flask'});

const hoveredNode = {
  frame: {
    name: 'instrumented_run',
    file: 'seer/concurrency_observability.py',
    path: '/app/src/seer/concurrency_observability.py',
    line: 51,
  },
} as FlamegraphFrame;

function AggregateContextMenu() {
  const contextMenu = useContextMenu({container: null});
  const {setOpen} = contextMenu;

  useEffect(() => {
    setOpen(true);
  }, [setOpen]);

  return (
    <FlamegraphStateProvider initialState={{}}>
      <ContinuousFlamegraphContextMenu
        contextMenu={contextMenu}
        hoveredNode={hoveredNode}
        isHighlightingAllOccurrences={false}
        onCopyFunctionNameClick={jest.fn()}
        onCopyFunctionSource={jest.fn()}
        onHighlightAllOccurrencesClick={jest.fn()}
        // Aggregate flamegraph responses have no project in their metadata.
        profileGroup={null}
        profileType="transaction aggregate flamegraph"
      />
    </FlamegraphStateProvider>
  );
}

describe('ContinuousFlamegraphContextMenu', () => {
  beforeEach(() => {
    MockApiClient.clearMockResponses();
    ProjectsStore.loadInitialData([project]);
  });

  afterEach(() => {
    PageFiltersStore.reset();
  });

  it('resolves the GitHub link using the selected project', async () => {
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [Number(project.id)]})
    );

    const stacktraceLink = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-link/`,
      body: {
        sourceUrl:
          'https://github.com/getsentry/seer/blob/main/src/seer/concurrency_observability.py',
        config: {provider: {key: 'github'}},
        integrations: [],
      },
    });

    render(<AggregateContextMenu />);

    await waitFor(() =>
      expect(screen.getByRole('menuitem', {name: 'Open in GitHub'})).toBeEnabled()
    );
    expect(stacktraceLink).toHaveBeenCalledWith(
      `/projects/org-slug/${project.slug}/stacktrace-link/`,
      expect.objectContaining({
        query: expect.objectContaining({
          file: 'seer/concurrency_observability.py',
          absPath: '/app/src/seer/concurrency_observability.py',
          platform: 'python-flask',
        }),
      })
    );
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
  });

  it('does not spin when no single project is selected', async () => {
    PageFiltersStore.onInitializeUrlState(PageFiltersFixture({projects: []}));

    const stacktraceLink = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-link/`,
      body: {},
    });

    render(<AggregateContextMenu />);

    expect(await screen.findByRole('menuitem', {name: 'Open in GitHub'})).toBeDisabled();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();
    expect(stacktraceLink).not.toHaveBeenCalled();
  });
});
