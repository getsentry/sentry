import {ApiTokenFixture} from 'sentry-fixture/apiToken';

import {
  render,
  renderGlobalModal,
  screen,
  userEvent,
} from 'sentry-test/reactTestingLibrary';

import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

describe('ApiTokenRow', () => {
  it('renders', () => {
    render(
      <ApiTokenRow
        onRemove={() => {}}
        token={ApiTokenFixture({id: '1', name: 'token1'})}
        canEdit
      />
    );

    screen.getByText(/token1/);
    expect(screen.getByRole('button', {name: 'Edit'})).toBeInTheDocument();
  });

  it('no button when not editable', () => {
    render(
      <ApiTokenRow
        onRemove={() => {}}
        token={ApiTokenFixture({id: '1', name: 'token1'})}
      />
    );
    expect(screen.queryByRole('button', {name: 'Edit'})).not.toBeInTheDocument();
  });

  it('calls onRemove callback when remove is clicked', async () => {
    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={ApiTokenFixture()} canEdit />);
    renderGlobalModal();

    await userEvent.click(screen.getByRole('button', {name: 'Revoke'}));
    await userEvent.click(screen.getByRole('button', {name: 'Confirm'}));
    expect(cb).toHaveBeenCalled();
  });

  it('displays token preview lastTokenCharacters field is found', () => {
    const token = ApiTokenFixture();
    token.tokenLastCharacters = 'a1b2c3d4';

    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={token} canEdit />);
    expect(screen.getByLabelText('Token preview')).toBeInTheDocument();
  });
});
