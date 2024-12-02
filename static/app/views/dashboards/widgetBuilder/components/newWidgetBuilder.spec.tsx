import {initializeOrg} from 'sentry-test/initializeOrg';
import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import OrganizationStore from 'sentry/stores/organizationStore';
import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import ProjectsStore from 'sentry/stores/projectsStore';
import {useNavigate} from 'sentry/utils/useNavigate';
import DevWidgetBuilder from 'sentry/views/dashboards/widgetBuilder/components/newWidgetBuilder';

const {organization, projects, router} = initializeOrg({
  organization: {features: ['global-views', 'open-membership']},
  projects: [
    {id: '1', slug: 'project-1', isMember: true},
    {id: '2', slug: 'project-2', isMember: true},
    {id: '3', slug: 'project-3', isMember: false},
  ],
  router: {
    location: {
      pathname: '/organizations/org-slug/dashboard/1/',
      query: {project: '-1'},
    },
    params: {},
  },
});

jest.mock('sentry/utils/useNavigate', () => ({
  useNavigate: jest.fn(),
}));

const mockUseNavigate = jest.mocked(useNavigate);

describe('NewWidgetBuiler', function () {
  const onCloseMock = jest.fn();

  beforeEach(function () {
    OrganizationStore.init();

    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      {
        projects: [],
        environments: [],
        datetime: {start: null, end: null, period: '14d', utc: null},
      },
      new Set(['projects'])
    );

    OrganizationStore.onUpdate(organization, {replace: true});
    ProjectsStore.loadInitialData(projects);

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/releases/',
      body: [],
    });

    MockApiClient.addMockResponse({
      url: '/organizations/org-slug/dashboard/1/',
      body: [],
    });
  });

  afterEach(() => PageFiltersStore.reset());

  it('renders', async function () {
    render(<DevWidgetBuilder isOpen onClose={onCloseMock} />, {
      router,
      organization,
    });

    expect(await screen.findByText('Create Custom Widget')).toBeInTheDocument();

    expect(await screen.findByLabelText('Close Widget Builder')).toBeInTheDocument();

    expect(await screen.findByRole('button', {name: 'All Projects'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Envs'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: '14D'})).toBeInTheDocument();
    expect(await screen.findByRole('button', {name: 'All Releases'})).toBeInTheDocument();

    expect(await screen.findByPlaceholderText('Name')).toBeInTheDocument();
    expect(await screen.findByText('+ Add Widget Description')).toBeInTheDocument();

    expect(await screen.findByText('TEST WIDGET')).toBeInTheDocument();
  });

  it('edits name and description', async function () {
    const mockNavigate = jest.fn();
    mockUseNavigate.mockReturnValue(mockNavigate);

    render(<DevWidgetBuilder isOpen onClose={onCloseMock} />, {
      router,
      organization,
    });

    await userEvent.type(await screen.findByPlaceholderText('Name'), 'some name');
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({title: 'some name'}),
      })
    );

    await userEvent.click(await screen.findByTestId('add-description'));

    await userEvent.type(
      await screen.findByPlaceholderText('Description'),
      'some description'
    );
    expect(mockNavigate).toHaveBeenLastCalledWith(
      expect.objectContaining({
        ...router.location,
        query: expect.objectContaining({description: 'some description'}),
      })
    );
  });
});
