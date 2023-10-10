import selectEvent from 'react-select-event';

import {render, screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

import ApiNewToken from 'sentry/views/settings/account/apiNewToken';

describe('ApiNewToken', function () {
  it('renders', function () {
    render(<ApiNewToken />, {
      context: TestStubs.routerContext(),
    });
  });

  it('renders with disabled "Create Token" button', async function () {
    render(<ApiNewToken />, {
      context: TestStubs.routerContext(),
    });

    expect(await screen.getByRole('button', {name: 'Create Token'})).toBeDisabled();
  });

  it('submits with correct hierarchical scopes', async function () {
    MockApiClient.clearMockResponses();
    const assignMock = MockApiClient.addMockResponse({
      method: 'POST',
      url: `/api-tokens/`,
    });

    render(<ApiNewToken />, {
      context: TestStubs.routerContext(),
    });
    const createButton = await screen.getByRole('button', {name: 'Create Token'});

    const selectByValue = (name, value) =>
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
});
