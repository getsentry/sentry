import {ApiToken as ApiTokenFixture} from 'sentry-fixture/apiToken';

import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import ApiTokenRow from 'sentry/views/settings/account/apiTokenRow';

describe('ApiTokenRow', () => {
  it('renders', () => {
    render(<ApiTokenRow onRemove={() => {}} token={ApiTokenFixture()} />);
  });

  it('calls onRemove callback when trash can is clicked', async () => {
    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={ApiTokenFixture()} />);

    await userEvent.click(screen.getByLabelText('Remove'));
    expect(cb).toHaveBeenCalled();
  });

  it('uses NewTokenHandler when lastTokenCharacters field is found', () => {
    const token = ApiTokenFixture();
    token.tokenLastCharacters = 'a1b2c3d4';

    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={token} />);
    expect(screen.queryByLabelText('Token preview')).toBeInTheDocument();
  });

  it('uses old logic when lastTokenCharacters field is not found', () => {
    const token = ApiTokenFixture();

    const cb = jest.fn();
    render(<ApiTokenRow onRemove={cb} token={token} />);
    expect(screen.queryByLabelText('Token preview')).not.toBeInTheDocument();
  });
});
