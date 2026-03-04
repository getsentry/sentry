import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AvatarButton} from '@sentry/scraps/button';

describe('AvatarButton', () => {
  it('renders letter avatar initials inside the button', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        avatar={{type: 'letter_avatar', identifier: 'test-id', name: 'Test User'}}
      />
    );

    const button = screen.getByRole('button', {name: 'Open profile'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('TU');
  });

  it('renders image avatar inside the button', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        avatar={{
          type: 'upload',
          identifier: 'test-id',
          name: 'Test User',
          uploadUrl: 'https://example.com/avatar.jpg',
        }}
      />
    );

    const button = screen.getByRole('button', {name: 'Open profile'});
    expect(button).toBeInTheDocument();
    expect(button.querySelector('img')).toHaveAttribute(
      'src',
      'https://example.com/avatar.jpg?s=120'
    );
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
