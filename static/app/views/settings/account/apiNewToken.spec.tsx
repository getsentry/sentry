import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';
import selectEvent from 'sentry-test/selectEvent';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  it('renders', function () {
    render(<ApiNewToken />);
  });

  it('renders with disabled "Create Token" button', function () {
    render(<ApiNewToken />);

    expect(screen.getByRole('button', {name: 'Create Token'})).toBeDisabled();
  });

  it('submits with correct hierarchical scopes', async function () {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/api-tokens/`,
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

  it('creates token with optional name', async function () {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/api-tokens/`,
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

  it('creates token without name', async function () {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/api-tokens/`,
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
});
