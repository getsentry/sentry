import {OrganizationFixture} from 'sentry-fixture/organization';
import {PageFiltersFixture} from 'sentry-fixture/pageFilters';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import PageFiltersStore from 'sentry/stores/pageFiltersStore';
import {ReplayQueryParamsProvider} from 'sentry/views/replays/list/replayQueryParamsProvider';
import {SaveReplayQueryButton} from 'sentry/views/replays/list/saveReplayQueryButton';

describe('SaveReplayQueryButton', () => {
  const organization = OrganizationFixture();

  beforeEach(() => {
    PageFiltersStore.init();
    PageFiltersStore.onInitializeUrlState(
      PageFiltersFixture({projects: [1], environments: ['production']})
    );
    MockApiClient.clearMockResponses();
  });

  function renderWithProvider(query = '') {
    return render(
      <ReplayQueryParamsProvider>
        <SaveReplayQueryButton />
      </ReplayQueryParamsProvider>,
      {
        organization,
        initialRouterConfig: {
          location: {
            pathname: '/replays/',
            query: query ? {query} : {},
          },
        },
      }
    );
  }

  it('renders the Save as button', () => {
    renderWithProvider();
    expect(screen.getByRole('button', {name: 'Save as'})).toBeInTheDocument();
  });

  it('does not disables the button when query is empty', () => {
    renderWithProvider();
    expect(screen.getByRole('button', {name: 'Save as'})).toBeEnabled();
  });

  it('enables the button when query is not empty', () => {
    renderWithProvider('browser.name:Chrome');
    expect(screen.getByRole('button', {name: 'Save as'})).toBeEnabled();
  });

  it('opens the save query modal when clicked', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    // Modal should be open with "New Query" title
    expect(await screen.findByRole('heading', {name: 'New Query'})).toBeInTheDocument();
  });

  it('displays name input in modal', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    // Check for name section and input
    expect(await screen.findByText('Name')).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText('Enter a name for your new query')
    ).toBeInTheDocument();
  });

  it('displays starred toggle in modal', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    // Check for starred toggle
    expect(await screen.findByText('Starred')).toBeInTheDocument();
  });

  it('displays Cancel and Create a New Query buttons in modal', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});
    expect(screen.getByRole('button', {name: 'Cancel'})).toBeInTheDocument();
    expect(screen.getByRole('button', {name: 'Create a New Query'})).toBeInTheDocument();
  });

  it('disables Create a New Query button when name is empty', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});
    expect(screen.getByRole('button', {name: 'Create a New Query'})).toBeDisabled();
  });

  it('enables Create a New Query button when name is entered', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});
    const nameInput = screen.getByPlaceholderText('Enter a name for your new query');
    await userEvent.type(nameInput, 'My Test Query');

    expect(screen.getByRole('button', {name: 'Create a New Query'})).toBeEnabled();
  });

  it('closes modal when Cancel is clicked', async () => {
    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});
    await userEvent.click(screen.getByRole('button', {name: 'Cancel'}));

    // Modal should be closed
    expect(screen.queryByRole('heading', {name: 'New Query'})).not.toBeInTheDocument();
  });

  it('saves query when form is submitted', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 1, name: 'My Test Query'},
    });

    renderWithProvider('browser.name:Chrome');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});
    const nameInput = screen.getByPlaceholderText('Enter a name for your new query');
    await userEvent.type(nameInput, 'My Test Query');
    await userEvent.click(screen.getByRole('button', {name: 'Create a New Query'}));

    expect(saveQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          name: 'My Test Query',
          dataset: 'replays',
          query: [
            expect.objectContaining({mode: 'samples', query: 'browser.name:Chrome'}),
          ],
          starred: true,
        }),
      })
    );
  });

  it('saves query with starred=false when toggle is off', async () => {
    const saveQueryMock = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/explore/saved/`,
      method: 'POST',
      body: {id: 1, name: 'My Test Query'},
    });

    renderWithProvider('user.email:test@example.com');
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Save as'}));

    await screen.findByRole('heading', {name: 'New Query'});

    // Turn off starred toggle
    const starredSwitch = screen.getByRole('checkbox');
    await userEvent.click(starredSwitch);

    const nameInput = screen.getByPlaceholderText('Enter a name for your new query');
    await userEvent.type(nameInput, 'Unstarred Query');
    await userEvent.click(screen.getByRole('button', {name: 'Create a New Query'}));

    expect(saveQueryMock).toHaveBeenCalledWith(
      `/organizations/${organization.slug}/explore/saved/`,
      expect.objectContaining({
        method: 'POST',
        data: expect.objectContaining({
          name: 'Unstarred Query',
          dataset: 'replays',
          starred: false,
        }),
      })
    );
  });
});
