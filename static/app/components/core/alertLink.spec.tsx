import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {AlertLink} from 'sentry/components/core/alertLink';

describe('AlertLink', () => {
  it('renders internal link pointing to the correct path', () => {
    render(
      <AlertLink type="info" to="/settings/accounts/notifications">
        This is an internal link button
      </AlertLink>
    );

    expect(
      screen.getByRole('link', {name: 'This is an internal link button'})
    ).toHaveAttribute('href', '/settings/accounts/notifications');
  });

  it('link has rel="noopener noreferrer" and target="_blank" when openInNewTab is true', () => {
    render(
      <AlertLink type="info" href="https://example.com" openInNewTab>
        This is an external link button
      </AlertLink>
    );

    const link = screen.getByRole('link', {
      name: 'This is an external link button',
    });

    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('does not have rel="noopener noreferrer" and target="_blank" when openInNewTab is not set', () => {
    render(
      <AlertLink type="info" href="https://example.com" openInNewTab={false}>
        This is an external link button
      </AlertLink>
    );

    const link = screen.getByRole('link', {
      name: 'This is an external link button',
    });

    expect(link).not.toHaveAttribute('target', '_blank');
    expect(link).not.toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('fires onClick when clicked', async () => {
    const onClick = jest.fn();

    render(
      <AlertLink type="info" onClick={onClick}>
        This is an external link button
      </AlertLink>
    );

    await userEvent.click(
      screen.getByRole('link', {name: 'This is an external link button'})
    );
    expect(onClick).toHaveBeenCalled();
  });

  it('renders a custom trailing item', () => {
    render(
      <AlertLink
        type="info"
        to="/settings/accounts/notifications"
        trailingItems={'custom trailing item'}
      >
        This is an external link button
      </AlertLink>
    );

    expect(screen.getByText('custom trailing item')).toBeInTheDocument();
  });
});
