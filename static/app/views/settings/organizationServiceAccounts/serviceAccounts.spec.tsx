import {OrganizationFixture} from 'sentry-fixture/organization';
import {ProjectFixture} from 'sentry-fixture/project';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
  within,
} from 'sentry-test/reactTestingLibrary';

import {ProjectsStore} from 'sentry/stores/projectsStore';

import NewServiceAccount from './newServiceAccount';
import ServiceAccountDetails from './serviceAccountDetails';
import OrganizationServiceAccounts from '.';

const organization = OrganizationFixture({features: ['service-accounts']});

function renderDetails(id: string) {
  return render(<ServiceAccountDetails />, {
    organization,
    initialRouterConfig: {
      location: {pathname: `/settings/${organization.slug}/service-accounts/${id}/`},
      route: '/settings/:orgId/service-accounts/:serviceAccountId/',
    },
  });
}

describe('Service accounts prototype', () => {
  beforeAll(() => {
    ProjectsStore.loadInitialData([
      ProjectFixture({id: '1', slug: 'javascript'}),
      ProjectFixture({id: '2', slug: 'backend'}),
      ProjectFixture({id: '3', slug: 'mobile'}),
    ]);
  });

  it('lists service accounts', async () => {
    render(<OrganizationServiceAccounts />, {organization});

    expect(
      await screen.findByRole('link', {name: 'github-actions-deploy'})
    ).toBeInTheDocument();
    expect(screen.getByRole('link', {name: 'triage-agent'})).toBeInTheDocument();
    expect(screen.getByText('backend, javascript')).toBeInTheDocument();
    expect(screen.getByText('3 projects')).toBeInTheDocument();
  });

  it('shows tokens with expiry labels and narrowed scopes', async () => {
    renderDetails('1');

    expect(await screen.findByText('prod deploy')).toBeInTheDocument();
    expect(screen.getByText('Expired')).toBeInTheDocument();
    expect(screen.getByText('In 6 days')).toBeInTheDocument();
    expect(screen.getByText('Partly outdated')).toBeInTheDocument();
    expect(screen.getAllByText('Same as account')).toHaveLength(2);
    expect(screen.getByText('sntrym_************7f3a')).toBeInTheDocument();
  });

  it('creates a token and shows it once', async () => {
    const {unmount} = renderDetails('3');
    renderGlobalModal();

    await userEvent.click(await screen.findByRole('button', {name: 'Create Token'}));
    const createModal = await screen.findByRole('dialog');
    await userEvent.type(within(createModal).getByRole('textbox', {name: 'Name'}), 'ci');
    await userEvent.click(
      within(createModal).getByRole('button', {name: 'Create Token'})
    );

    expect(await screen.findByText('Token created')).toBeInTheDocument();
    expect(
      screen.getByRole<HTMLInputElement>('textbox', {name: 'Generated token'}).value
    ).toMatch(/^sntrym_/);
    await userEvent.click(screen.getByRole('button', {name: 'Done'}));

    // Test renders give the modal its own query client, so render the page again.
    unmount();
    renderDetails('3');
    expect(await screen.findByText('ci')).toBeInTheDocument();
    expect(screen.getByText('Never')).toBeInTheDocument();
  });

  it('revokes a token', async () => {
    renderDetails('2');
    renderGlobalModal();

    await userEvent.click(
      await screen.findByRole('button', {name: 'Revoke nightly triage'})
    );
    await userEvent.click(await screen.findByRole('button', {name: 'Revoke Token'}));

    expect(await screen.findByText('No tokens yet')).toBeInTheDocument();
  });

  it('creates a service account and opens its details', async () => {
    const {router} = render(<NewServiceAccount />, {
      organization,
      initialRouterConfig: {
        location: {pathname: `/settings/${organization.slug}/service-accounts/new/`},
        route: '/settings/:orgId/service-accounts/new/',
      },
    });

    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));
    expect(await screen.findByText('Name is required')).toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'triage-agent');
    // Changing one permission turns the preset into Custom.
    await userEvent.click(screen.getByRole('button', {name: 'Teams permission'}));
    await userEvent.click(await screen.findByRole('option', {name: 'No Access'}));
    expect(screen.getByRole('button', {name: 'Start from'})).toHaveTextContent('Custom');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));
    expect(
      await screen.findByText('A service account with this name already exists.')
    ).toBeInTheDocument();

    await userEvent.clear(screen.getByRole('textbox', {name: 'Name'}));
    await userEvent.type(screen.getByRole('textbox', {name: 'Name'}), 'nightly-report');
    await userEvent.click(screen.getByRole('button', {name: 'Create Service Account'}));
    await waitFor(() =>
      expect(router.location.pathname).toMatch(
        new RegExp(`^/settings/${organization.slug}/service-accounts/\\d+/$`)
      )
    );
  });
});
