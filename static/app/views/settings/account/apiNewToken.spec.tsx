import {ApiTokenFixture} from 'sentry-fixture/apiToken';
import {OrganizationFixture} from 'sentry-fixture/organization';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
  waitFor,
} from 'sentry-test/reactTestingLibrary';
import {selectEvent} from 'sentry-test/selectEvent';

import * as indicators from 'sentry/actionCreators/indicator';
import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', () => {
  it('renders', () => {
    render(<ApiNewToken />);
  });

  it('renders with disabled "Create Token" button', () => {
    render(<ApiNewToken />);

    expect(screen.getByRole('button', {name: 'Create Token'})).toBeDisabled();
  });

  it('submits with correct hierarchical scopes', async () => {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-tokens/',
    });

    render(<ApiNewToken />);
    const createButton = screen.getByRole('button', {name: 'Create Token'});

    const selectByValue = (name: string, value: string) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    // Assigning Admin here will also grant read + write access to the resource
    await selectByValue('Project', 'Admin');
    await selectByValue('Release', 'Admin');
    await selectByValue('Team', 'Admin');
    await selectByValue('Issue & Event', 'Admin');
    await selectByValue('Organization', 'Admin');
    await selectByValue('Member', 'Admin');

    await userEvent.click(createButton);

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/',
        expect.objectContaining({
          data: expect.objectContaining({
            scopes: expect.arrayContaining([
              'project:read',
              'project:write',
              'project:admin',
              'project:releases',
              'team:read',
              'team:write',
              'team:admin',
              'event:read',
              'event:write',
              'event:admin',
              'org:read',
              'org:write',
              'org:admin',
              'org:integrations',
              'member:read',
              'member:write',
              'member:admin',
            ]),
          }),
        })
      )
    );
  });

  it('creates token with optional name', async () => {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-tokens/',
    });

    render(<ApiNewToken />);
    const createButton = screen.getByRole('button', {name: 'Create Token'});

    const selectByValue = (name: string, value: string) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    await selectByValue('Project', 'Admin');
    await selectByValue('Release', 'Admin');

    await userEvent.type(screen.getByLabelText('Name'), 'My Token');

    await userEvent.click(createButton);

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: 'My Token',
            scopes: expect.arrayContaining([
              'project:read',
              'project:write',
              'project:admin',
              'project:releases',
            ]),
          }),
        })
      )
    );
  });

  it('creates token without name', async () => {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-tokens/',
    });

    render(<ApiNewToken />);
    const createButton = screen.getByRole('button', {name: 'Create Token'});

    const selectByValue = (name: string, value: string) =>
      selectEvent.select(screen.getByRole('textbox', {name}), value);

    await selectByValue('Project', 'Admin');
    await selectByValue('Release', 'Admin');

    await userEvent.click(createButton);

    await waitFor(() =>
      expect(assignMock).toHaveBeenCalledWith(
        '/api-tokens/',
        expect.objectContaining({
          data: expect.objectContaining({
            name: '', // expect a blank name
            scopes: expect.arrayContaining([
              'project:read',
              'project:write',
              'project:admin',
              'project:releases',
            ]),
          }),
        })
      )
    );
  });

  it('shows new token modal after successful creation', async () => {
    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-tokens/',
      body: ApiTokenFixture({token: 'sntrys_test_token_123'}),
    });

    render(<ApiNewToken />);
    renderGlobalModal();

    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'Read');

    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    expect(await screen.findByLabelText('Generated token')).toHaveValue(
      'sntrys_test_token_123'
    );
  });

  it('displays permissions preview when scopes are selected', async () => {
    render(<ApiNewToken />);

    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'Read');
    expect(screen.getByText(/project:read/)).toBeInTheDocument();

    await selectEvent.select(screen.getByRole('textbox', {name: 'Team'}), 'Admin');
    expect(screen.getByText(/team:admin/)).toBeInTheDocument();
  });

  it('shows error message when token creation fails', async () => {
    jest.spyOn(indicators, 'addErrorMessage');

    MockApiClient.clearMockResponses();
    MockApiClient.addMockResponse({
      method: 'POST',
      url: '/api-tokens/',
      statusCode: 400,
    });

    render(<ApiNewToken />);

    await selectEvent.select(screen.getByRole('textbox', {name: 'Project'}), 'Read');

    await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

    await waitFor(() => expect(indicators.addErrorMessage).toHaveBeenCalled());
  });

  it('does not render CI-only permissions for personal tokens', () => {
    render(<ApiNewToken />);
    expect(
      screen.queryByRole('checkbox', {name: 'Continuous Integration (CI)'})
    ).not.toBeInTheDocument();
  });

  it('does not render granular permissions without the flag', () => {
    render(<ApiNewToken />);
    expect(screen.getByRole('textbox', {name: 'Project'})).toBeInTheDocument();
    expect(screen.queryByRole('textbox', {name: 'Dashboards'})).not.toBeInTheDocument();
  });

  describe('with granular-permission-scopes-ui', () => {
    const organization = OrganizationFixture({
      features: ['granular-permission-scopes-ui'],
    });

    it('replaces the existing permissions with granular ones', () => {
      render(<ApiNewToken />, {organization});
      expect(screen.getByRole('textbox', {name: 'Dashboards'})).toBeInTheDocument();
      expect(screen.queryByRole('textbox', {name: 'Project'})).not.toBeInTheDocument();
    });

    it('submits the selected level, the levels before it, and extra scopes', async () => {
      MockApiClient.clearMockResponses();
      const assignMock = MockApiClient.addMockResponse({
        method: 'POST',
        url: '/api-tokens/',
      });

      render(<ApiNewToken />, {organization});

      await selectEvent.select(
        screen.getByRole('textbox', {name: 'Dashboards'}),
        'Write'
      );
      await selectEvent.select(screen.getByRole('textbox', {name: 'Members'}), 'Read');
      await userEvent.click(screen.getByRole('checkbox', {name: 'Invite'}));

      const expectedScopes = [
        'dashboard:create',
        'dashboard:read',
        'dashboard:write',
        'member:invite',
        'member:read',
      ];
      expect(screen.getByText(expectedScopes.join(', '))).toBeInTheDocument();

      await userEvent.click(screen.getByRole('button', {name: 'Create Token'}));

      await waitFor(() =>
        expect(assignMock).toHaveBeenCalledWith(
          '/api-tokens/',
          expect.objectContaining({
            data: expect.objectContaining({scopes: expectedScopes}),
          })
        )
      );
    });
  });
});
