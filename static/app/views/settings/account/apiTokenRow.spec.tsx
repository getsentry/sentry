import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

describe('ApiTokenRow', () => {
  it('renders link when can edit', () => {
    render(
      <ApiTokenRow
        onRemove={() => {}}
        token={ApiTokenFixture({id: '1', name: 'token1'})}
        canEdit
      />
    );
    screen.getByRole('link', {name: /token1/i});
  });

  it('renders text when cannot edit', () => {
    render(
      <ApiTokenRow
        onRemove={() => {}}
        token={ApiTokenFixture({id: '1', name: 'token1'})}
      />
    );
    screen.getByText(/token1/);
  });

  it('calls onRemove callback when trash can is clicked', async () => {
    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={ApiTokenFixture()} canEdit />);
    renderGlobalModal();

    await userEvent.click(screen.getByLabelText('Remove'));
    await userEvent.click(screen.getByLabelText('Confirm'));
    expect(cb).toHaveBeenCalled();
  });

  it('uses NewTokenHandler when lastTokenCharacters field is found', () => {
    const token = ApiTokenFixture();
    token.tokenLastCharacters = 'a1b2c3d4';

    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={token} canEdit />);
    expect(screen.getByLabelText('Token preview')).toBeInTheDocument();
  });
});
