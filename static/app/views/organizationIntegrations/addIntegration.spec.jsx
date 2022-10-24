import {render, waitFor} from 'sentry-test/reactTestingLibrary';

import AddIntegration from 'sentry/views/organizationIntegrations/addIntegration';

describe('AddIntegration', function () {
  const provider = TestStubs.GitHubIntegrationProvider();
  const integration = TestStubs.GitHubIntegration();

  it('Adds an integration on dialog completion', async function () {
    const onAdd = jest.fn();

    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus});
    global.open = open;

    render(
      <AddIntegration provider={provider} onInstall={onAdd}>
        {onClick => (
          <a href="#" onClick={onClick}>
            Click
          </a>
        )}
      </AddIntegration>
    );

    const newIntegration = {
      success: true,
      data: Object.assign({}, integration, {
        id: '2',
        domain_name: 'new-integration.github.com',
        icon: 'http://example.com/new-integration-icon.png',
        name: 'New Integration',
      }),
    };

    window.postMessage(newIntegration, '*');
    await waitFor(() => expect(onAdd).toHaveBeenCalledWith(newIntegration.data));
  });
});
