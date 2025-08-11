import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {act, renderGlobalModal, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {displayNewToken} from 'sentry/views/settings/components/newTokenHandler';

describe('displayNewToken', function () {
  it('renders', async function () {
    renderGlobalModal();

    const callback = jest.fn();
    const token = ApiTokenFixture();

    act(() => displayNewToken(token.token, callback));

    expect(screen.getByLabelText('Generated token')).toHaveValue(token.token);
    await userEvent.click(screen.getByRole('button', {name: "I've saved it"}));
    expect(callback).toHaveBeenCalled();
  });
});
