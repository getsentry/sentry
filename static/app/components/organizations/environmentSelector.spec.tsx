import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import EnvironmentSelector from 'sentry/components/organizations/environmentSelector';
import {ALL_ACCESS_PROJECTS} from 'sentry/constants/pageFilters';
import ConfigStore from 'sentry/stores/configStore';

describe('EnvironmentSelector', function () {
  const onUpdate = jest.fn();

  const projects = [
    TestStubs.Project({
      id: '1',
      slug: 'first',
      environments: ['production', 'staging'],
    }),
    TestStubs.Project({
      id: '2',
      slug: 'second',
      environments: ['dev'],
    }),
    TestStubs.Project({
      id: '3',
      slug: 'no member',
      environments: ['no-env'],
      isMember: false,
    }),
  ];
  const organization = TestStubs.Organization({projects});
  const selectedProjects = [1, 2];
  const routerContext = TestStubs.routerContext([
    {
      organization,
    },
  ]);

  beforeEach(function () {
    ConfigStore.init();
    ConfigStore.loadInitialData(TestStubs.Config());
    onUpdate.mockReset();
  });

  const customDropdownButton = ({value}) => {
    const summary = value.length ? value.join(', ') : 'All Environments';
    return <div>{summary}</div>;
  };

  const selectorProps = {
    organization,
    projects,
    value: [],
    loadingProjects: false,
    selectedProjects,
    onUpdate,
    customDropdownButton,
    customLoadingIndicator: () => 'Loading...',
  };

  function renderSelector(
    props?: Partial<React.ComponentProps<typeof EnvironmentSelector>>
  ) {
    return render(<EnvironmentSelector {...selectorProps} {...props} />, {
      context: routerContext,
    });
  }

  async function clickMenu() {
    const button = await screen.findByRole('button', {name: 'All Environments'});
    userEvent.click(button);
  }

  it('can select and change environments', async function () {
    renderSelector();
    await clickMenu();

    screen.queryAllByRole('checkbox').forEach(box => userEvent.click(box));
    userEvent.click(await screen.findByLabelText('Apply'));

    expect(onUpdate).toHaveBeenCalledWith(['dev', 'production', 'staging']);
  });

  it('selects multiple environments and uses button to update', async function () {
    renderSelector();
    await clickMenu();

    userEvent.click(screen.queryAllByRole('checkbox')[0]);
    expect(onUpdate).not.toHaveBeenCalled();

    await clickMenu();
    expect(onUpdate).toHaveBeenCalledWith(['dev']);
  });

  it('does not update when there are no changes', async function () {
    renderSelector();
    await clickMenu();

    // Click and unclick boxes
    screen.queryAllByRole('checkbox').forEach(box => userEvent.click(box));
    screen.queryAllByRole('checkbox').forEach(box => userEvent.click(box));

    await clickMenu();
    expect(onUpdate).not.toHaveBeenCalled();
  });

  it('updates environment options when projects selection changes', async function () {
    const {rerender} = renderSelector();

    await clickMenu();
    screen.queryAllByRole('checkbox').forEach(box => userEvent.click(box));
    await clickMenu();

    // Changing projects will unselect environments. Project 2 has 1 environment
    rerender(<EnvironmentSelector {...selectorProps} selectedProjects={[2]} />);

    // There should just be 1 environment now
    await clickMenu();
    expect(screen.getByLabelText('dev')).toBeInTheDocument();
    expect(screen.queryByLabelText('production')).not.toBeInTheDocument();
  });

  it('shows non-member project environments when selected', async function () {
    renderSelector({selectedProjects: [3]});
    await clickMenu();

    expect(screen.getByRole('checkbox')).toBeInTheDocument();

    expect(screen.getByLabelText('no-env')).toBeInTheDocument();
  });

  it('shows member project environments when there are no projects selected', async function () {
    renderSelector({selectedProjects: []});
    await clickMenu();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

    expect(screen.getByLabelText('production')).toBeInTheDocument();
    expect(screen.getByLabelText('staging')).toBeInTheDocument();
    expect(screen.getByLabelText('dev')).toBeInTheDocument();
  });

  it('does not open selector menu when disabled', async function () {
    renderSelector({disabled: true});
    await clickMenu();

    // Dropdown not open
    expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
  });

  describe('Superuser My Projects / all environments', function () {
    it('shows env when no team belonging', async function () {
      ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});

      renderSelector({
        selectedProjects: [],
        projects: [
          TestStubs.Project({
            id: '1',
            slug: 'first',
            environments: ['production', 'staging'],
            isMember: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'second',
            environments: ['dev'],
            isMember: false,
          }),
        ],
      });

      await clickMenu();

      expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

      expect(screen.getByLabelText('production')).toBeInTheDocument();
      expect(screen.getByLabelText('staging')).toBeInTheDocument();
      expect(screen.getByLabelText('dev')).toBeInTheDocument();
    });

    it('shows env when belongs one team', async function () {
      // XXX: Ideally, "My Projects" and "All Projects" should be different if a
      // superuser was to belong to at least one project
      ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});

      // This user is member of one project
      renderSelector({
        selectedProjects: [],
        projects: [
          TestStubs.Project({
            id: '1',
            slug: 'first',
            environments: ['production', 'staging'],
          }),
          TestStubs.Project({
            id: '2',
            slug: 'second',
            environments: ['dev'],
            isMember: false,
          }),
        ],
      });

      await clickMenu();

      expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

      expect(screen.getByLabelText('production')).toBeInTheDocument();
      expect(screen.getByLabelText('staging')).toBeInTheDocument();
      expect(screen.getByLabelText('dev')).toBeInTheDocument();
    });
  });

  describe('Superuser All Projects / all environments', function () {
    it('shows env when no team belonging', async function () {
      ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});

      renderSelector({
        selectedProjects: [ALL_ACCESS_PROJECTS],
        projects: [
          TestStubs.Project({
            id: '1',
            slug: 'first',
            environments: ['production', 'staging'],
            isMember: false,
          }),
          TestStubs.Project({
            id: '2',
            slug: 'second',
            environments: ['dev'],
            isMember: false,
          }),
        ],
      });

      await clickMenu();

      expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

      expect(screen.getByLabelText('production')).toBeInTheDocument();
      expect(screen.getByLabelText('staging')).toBeInTheDocument();
      expect(screen.getByLabelText('dev')).toBeInTheDocument();
    });

    it('shows env when belongs one team', async function () {
      // XXX: Ideally, "My Projects" and "All Projects" should be different if a
      // superuser was to belong to at least one project
      ConfigStore.set('user', {...ConfigStore.get('user'), isSuperuser: true});

      renderSelector({
        selectedProjects: [ALL_ACCESS_PROJECTS],
        projects: [
          TestStubs.Project({
            id: '1',
            slug: 'first',
            environments: ['production', 'staging'],
          }),
          TestStubs.Project({
            id: '2',
            slug: 'second',
            environments: ['dev'],
            isMember: false,
          }),
        ],
      });

      await clickMenu();

      expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

      expect(screen.getByLabelText('production')).toBeInTheDocument();
      expect(screen.getByLabelText('staging')).toBeInTheDocument();
      expect(screen.getByLabelText('dev')).toBeInTheDocument();
    });
  });

  it('shows all project environments when "all projects" is selected', async function () {
    renderSelector({selectedProjects: [ALL_ACCESS_PROJECTS]});
    await clickMenu();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(4);

    expect(screen.getByLabelText('production')).toBeInTheDocument();
    expect(screen.getByLabelText('staging')).toBeInTheDocument();
    expect(screen.getByLabelText('dev')).toBeInTheDocument();
    expect(screen.getByLabelText('no-env')).toBeInTheDocument();
  });

  it('shows the distinct union of environments across all projects', async function () {
    renderSelector({selectedProjects: [1, 2]});
    await clickMenu();

    expect(screen.queryAllByRole('checkbox')).toHaveLength(3);

    expect(screen.getByLabelText('production')).toBeInTheDocument();
    expect(screen.getByLabelText('staging')).toBeInTheDocument();
    expect(screen.getByLabelText('dev')).toBeInTheDocument();
  });

  it('can quick select an environment', async function () {
    renderSelector();
    await clickMenu();

    // Select something first, we want to make sure that having a changed
    // selection doesn't effect the quick select
    userEvent.click(screen.getByRole('checkbox', {name: 'dev'}));

    // Now 'quick select' the production environment
    userEvent.click(screen.getByText('production'));

    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(onUpdate).toHaveBeenCalledWith(['production']);
  });
});
