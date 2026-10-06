import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AvatarButton} from '@sentry/scraps/avatarButton';

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

  it('renders a placeholder icon when no avatar is provided', () => {
    render(<AvatarButton aria-label="Assign" />);

    const button = screen.getByRole('button', {name: 'Assign'});
    expect(button).toBeInTheDocument();
    expect(button.querySelector('img')).not.toBeInTheDocument();
    expect(button.querySelector('svg')).toBeInTheDocument();
  });

  it('renders a suggested letter avatar without throwing', () => {
    render(
      <AvatarButton
        aria-label="Suggested assignee"
        avatar={{
          type: 'letter_avatar',
          identifier: 'test-id',
          name: 'Test User',
          suggested: true,
        }}
      />
    );

    const button = screen.getByRole('button', {name: 'Suggested assignee'});
    expect(button).toBeInTheDocument();
    expect(button).toHaveTextContent('TU');
  });

  it('accepts a round shape override', () => {
    render(
      <AvatarButton
        aria-label="Open profile"
        round
        avatar={{type: 'letter_avatar', identifier: 'test-id', name: 'Test User'}}
      />
    );

    expect(screen.getByRole('button', {name: 'Open profile'})).toBeInTheDocument();
  });
});
