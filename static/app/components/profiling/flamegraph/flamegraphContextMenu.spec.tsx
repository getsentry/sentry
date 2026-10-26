import {ProjectFixture} from 'sentry-fixture/project';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {
  ContinuousFlamegraphContextMenu,
  FlamegraphContextMenu,
} from 'sentry/components/profiling/flamegraph/flamegraphContextMenu';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {CallTreeNode} from 'sentry/utils/profiling/callTreeNode';
import {FlamegraphStateProvider} from 'sentry/utils/profiling/flamegraph/flamegraphStateProvider/flamegraphContextProvider';
import {Frame} from 'sentry/utils/profiling/frame';
import {useContextMenu} from 'sentry/utils/profiling/hooks/useContextMenu';
import type {ProfileGroup} from 'sentry/utils/profiling/profile/importProfile';

describe.each([
  ['FlamegraphContextMenu', FlamegraphContextMenu],
  ['ContinuousFlamegraphContextMenu', ContinuousFlamegraphContextMenu],
] as const)('%s', (_name, ContextMenu) => {
  it('shows skipped source links as unavailable without loading indefinitely', async () => {
    const project = ProjectFixture();
    ProjectsStore.loadInitialData([project]);
    const lookup = MockApiClient.addMockResponse({
      url: `/projects/org-slug/${project.slug}/stacktrace-link/`,
      body: {},
    });
    const frame = new Frame({
      key: 0,
      name: 'processTicksAndRejections',
      file: 'node:internal/process/task_queues',
    });
    const profileGroup: ProfileGroup = {
      activeProfileIndex: 0,
      measurements: {},
      metadata: {projectID: Number(project.id), platform: 'node'},
      name: 'profile',
      profiles: [],
      traceID: '',
      transactionID: null,
      type: 'transaction',
    };

    function Menu() {
      const contextMenu = useContextMenu({container: null});
      return (
        <ContextMenu
          contextMenu={{...contextMenu, open: true}}
          hoveredNode={{
            children: [],
            depth: 0,
            end: 1,
            frame,
            key: 0,
            node: new CallTreeNode(frame, null),
            parent: null,
            start: 0,
          }}
          isHighlightingAllOccurrences={false}
          onCopyFunctionNameClick={jest.fn()}
          onCopyFunctionSource={jest.fn()}
          onHighlightAllOccurrencesClick={jest.fn()}
          profileGroup={profileGroup}
          profileType="transaction profile"
        />
      );
    }

    render(
      <FlamegraphStateProvider>
        <Menu />
      </FlamegraphStateProvider>
    );

    const openInGitHub = screen.getByRole('menuitem', {name: 'Open in GitHub'});
    expect(openInGitHub).toBeDisabled();
    expect(screen.queryByTestId('loading-indicator')).not.toBeInTheDocument();

    await userEvent.hover(openInGitHub.parentElement!);
    expect(
      await screen.findByText('Could not find source code location in GitHub')
    ).toBeInTheDocument();
    expect(lookup).not.toHaveBeenCalled();
  });
});
