/* global global */
import {GitHubIntegrationProvider} from 'sentry-fixture/githubIntegrationProvider';
import {Organization} from 'sentry-fixture/organization';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AddIntegrationButton} from 'sentry/views/settings/organizationIntegrations/addIntegrationButton';

describe('AddIntegrationButton', function () {
  const provider = GitHubIntegrationProvider();

  it('Opens the setup dialog on click', async function () {
    const focus = jest.fn();
    const open = jest.fn().mockReturnValue({focus, close: jest.fn()});
    // any is needed here because getSentry has different types for global
    (global as any).open = open;

    render(
      <AddIntegrationButton
        provider={provider}
        onAddIntegration={jest.fn()}
        organization={Organization()}
      />
    );

    await userEvent.click(screen.getByLabelText('Add integration'));
    expect(open.mock.calls).toHaveLength(1);
    expect(focus.mock.calls).toHaveLength(1);
    expect(open.mock.calls[0][2]).toBe(
      'scrollbars=yes,width=100,height=100,top=334,left=462'
    );
  });
});
