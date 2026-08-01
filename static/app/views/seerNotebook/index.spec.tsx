import {
  InvestigationDetailFixture,
  InvestigationListItemFixture,
} from 'sentry-fixture/investigation';
import {MemberFixture} from 'sentry-fixture/member';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import SeerNotebookLauncher from 'sentry/views/seerNotebook';

describe('SeerNotebookLauncher', () => {
  const organization = OrganizationFixture({features: ['investigations']});

  beforeEach(() => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/`,
      body: [InvestigationListItemFixture()],
    });
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/members/`,
      body: [MemberFixture({id: '1', name: 'Investigation Owner'})],
    });
  });

  it('loads persisted investigations and fills a suggested Seer prompt', async () => {
    render(<SeerNotebookLauncher />, {organization});

    expect(await screen.findByText('Checkout regression')).toBeInTheDocument();
    await userEvent.click(screen.getByText('Why did checkout get slower?'));

    expect(screen.getByRole('textbox', {name: 'Ask Seer'})).toHaveValue(
      'Why did checkout get slower?'
    );
  });

  it('creates an empty investigation and navigates to it', async () => {
    const created = InvestigationDetailFixture({id: 'new-investigation'});
    const createRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/`,
      method: 'POST',
      body: created,
    });
    const {router} = render(<SeerNotebookLauncher />, {organization});

    await userEvent.click(screen.getByRole('button', {name: 'New Investigation'}));

    await waitFor(() => expect(createRequest).toHaveBeenCalled());
    expect(router.location.pathname).toBe(
      `/organizations/${organization.slug}/seer/new-investigation/`
    );
  });

  it('renders the feature-disabled state when investigations are unavailable', () => {
    render(<SeerNotebookLauncher />, {
      organization: OrganizationFixture({features: []}),
    });

    expect(
      screen.getByText('This feature is not enabled on your Sentry installation.')
    ).toBeInTheDocument();
  });

  it('filters investigations in the browser and shows the dashboard-style empty state', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/`,
      body: [
        InvestigationListItemFixture({id: 'checkout', title: 'Checkout regression'}),
        InvestigationListItemFixture({id: 'payments', title: 'Payments latency'}),
      ],
    });
    render(<SeerNotebookLauncher />, {organization});

    const search = await screen.findByPlaceholderText('Search Investigations');
    await userEvent.type(search, 'payments');

    expect(await screen.findByText('Payments latency')).toBeInTheDocument();
    await waitFor(() =>
      expect(screen.queryByText('Checkout regression')).not.toBeInTheDocument()
    );

    await userEvent.clear(search);
    await userEvent.type(search, 'nothing');
    expect(
      await screen.findByText('Sorry, no Investigations match your filters.')
    ).toBeInTheDocument();
  });

  it('stars an investigation optimistically', async () => {
    const favoriteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${
        InvestigationListItemFixture().id
      }/favorite/`,
      method: 'PUT',
      statusCode: 204,
    });
    render(<SeerNotebookLauncher />, {organization});

    await userEvent.click(
      await screen.findByRole('button', {name: 'Star investigation'})
    );

    expect(
      screen.getByRole('button', {name: 'Unstar investigation'})
    ).toBeInTheDocument();
    expect(favoriteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {shouldFavorite: true}})
    );
  });

  it('sorts the visible investigations in the browser', async () => {
    MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/`,
      body: [
        InvestigationListItemFixture({id: 'alpha', title: 'Alpha investigation'}),
        InvestigationListItemFixture({id: 'zulu', title: 'Zulu investigation'}),
      ],
    });
    render(<SeerNotebookLauncher />, {organization});

    await screen.findByText('Alpha investigation');
    await userEvent.click(
      screen.getByRole('button', {name: 'Sort By My Investigations'})
    );
    await userEvent.click(
      await screen.findByRole('option', {name: 'Investigation Name (Z-A)'})
    );

    const rows = screen.getAllByTestId('grid-body-row');
    expect(within(rows[0]!).getByText('Zulu investigation')).toBeInTheDocument();
    expect(within(rows[1]!).getByText('Alpha investigation')).toBeInTheDocument();
  });

  it('duplicates and deletes investigations from row actions', async () => {
    const item = InvestigationListItemFixture();
    const duplicateRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${item.id}/duplicate/`,
      method: 'POST',
      body: InvestigationDetailFixture({id: 'duplicate'}),
    });
    const deleteRequest = MockApiClient.addMockResponse({
      url: `/organizations/${organization.slug}/investigations/${item.id}/`,
      method: 'DELETE',
      statusCode: 204,
    });
    render(<SeerNotebookLauncher />, {organization});
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Duplicate investigation'})
    );
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );
    await waitFor(() => expect(duplicateRequest).toHaveBeenCalled());

    await userEvent.click(screen.getByRole('button', {name: 'Delete investigation'}));
    await userEvent.click(
      within(screen.getByRole('dialog')).getByRole('button', {name: /confirm/i})
    );
    await waitFor(() => expect(deleteRequest).toHaveBeenCalled());
    expect(deleteRequest).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({data: {investigationVersion: item.version}})
    );
  });
});
