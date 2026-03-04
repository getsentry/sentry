import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AvatarButton} from '@sentry/scraps/button';

describe('AvatarButton', () => {
  it('renders avatar content inside the button', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        avatar={{type: 'letter_avatar', identifier: 'test-id', name: 'Test User'}}
      />
    );

    const button = screen.getByRole('button', {name: 'Open profile'});
    const avatar = button.querySelector('.avatar');

    expect(avatar).toBeInTheDocument();
    expect(avatar).toHaveStyle({width: '36px', height: '36px'});
  });

  it('sets avatar size based on the button size', () => {
    render(
      <AvatarButton
        size="sm"
        aria-label="Open small profile"
        avatar={{type: 'letter_avatar', identifier: 'small-id', name: 'Small User'}}
      />
    );

    const button = screen.getByRole('button', {name: 'Open small profile'});
    const avatar = button.querySelector('.avatar');

    expect(avatar).toHaveStyle({width: '32px', height: '32px'});
  });

  it('calls `onClick` callback', async () => {
    const spy = jest.fn();
    render(
      <AvatarButton
        aria-label="Open profile"
        onClick={spy}
        avatar={{type: 'letter_avatar', identifier: 'test-id', name: 'Test User'}}
      />
    );

    await userEvent.click(screen.getByRole('button', {name: 'Open profile'}));

    expect(spy).toHaveBeenCalledTimes(1);
  });
});
