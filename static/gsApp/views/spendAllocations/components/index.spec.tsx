import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ProjectsStore from 'sentry/stores/projectsStore';

import ProjectSelectControl from 'getsentry/views/spendAllocations/components/projectSelectControl';

describe('projectSelectControl', () => {
  const {projects} = initializeOrg();

  beforeEach(() => {
    ProjectsStore.loadInitialData(projects);
  });

  afterEach(() => {
    ProjectsStore.reset();
  });

  it('removes options that are filtered out', async () => {
    const {rerender} = render(
      <ProjectSelectControl
        disabled={false}
        filteredIdList={[]}
        onChange={vi.fn()}
        value=""
      />
    );
    await selectEvent.openMenu(screen.getByText('Select a project to continue'));
    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
    rerender(
      <ProjectSelectControl
        disabled={false}
        filteredIdList={[projects[0]!.id]}
        onChange={vi.fn()}
        value=""
      />
    );
    expect(screen.getByText('No options')).toBeInTheDocument();
  });

  it('calls invokes onChange on select', async () => {
    const mockCallback = vi.fn();
    render(
      <ProjectSelectControl
        disabled={false}
        filteredIdList={[]}
        onChange={mockCallback}
        value=""
      />
    );
    await selectEvent.openMenu(screen.getByText('Select a project to continue'));
    expect(screen.getAllByTestId('badge-display-name')).toHaveLength(1);
    expect(mockCallback.mock.calls).toHaveLength(0);

    // Menu is still open from above
    await userEvent.click(screen.getByText(projects[0]!.slug));
    expect(mockCallback.mock.calls).toHaveLength(1);
  });
});
