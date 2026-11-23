import {screen, userEvent, waitFor} from 'sentry-test/reactTestingLibrary';

export async function waitForAuthorization() {
  const button = await screen.findByRole('button', {name: 'Authorize'});
  await userEvent.hover(button);
  await waitFor(() => expect(button).toBeEnabled(), {timeout: 2000});
  return button;
}
