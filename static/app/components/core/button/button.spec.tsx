import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {Button, LinkButton} from '@sentry/scraps/button';

describe('Button', () => {
  it('renders', () => {
    render(<Button variant="primary">Button</Button>);
  });

  it('calls `onClick` callback', async () => {
    const spy = jest.fn();
    render(<Button onClick={spy}>Click me</Button>);
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).toHaveBeenCalled();
  });

  it('does not call `onClick` on disabled buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} disabled>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('does not call `onClick` on busy buttons', async () => {
    const spy = jest.fn();
    render(
      <Button onClick={spy} busy>
        Click me
      </Button>
    );
    await userEvent.click(screen.getByText('Click me'));

    expect(spy).not.toHaveBeenCalled();
  });

  it('shows spinner when busy', () => {
    render(<Button busy>Busy Button</Button>);

    const button = screen.getByRole('button', {name: 'Busy Button'});
    expect(button).toHaveAttribute('aria-busy', 'true');
    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).toBeInTheDocument();
  });

  it('hides spinner when not busy', () => {
    render(<Button>Normal Button</Button>);

    const button = screen.getByRole('button', {name: 'Normal Button'});
    expect(button).not.toHaveAttribute('aria-busy');

    const spinner = button.querySelector('[aria-hidden="true"]');
    expect(spinner).not.toBeInTheDocument();
  });

  describe('with href (navigation variant)', () => {
    it('renders an internal link as react-router Link', () => {
      render(<Button href="/settings">Settings</Button>);

      const element = screen.getByRole('button', {name: 'Settings'});
      expect(element).toHaveAttribute('href', '/settings');
      expect(element).not.toHaveAttribute('target');
    });

    it('auto-detects external URLs and opens in new tab', () => {
      render(<Button href="https://docs.sentry.io">Docs</Button>);

      const element = screen.getByRole('button', {name: 'Docs'});
      expect(element).toHaveAttribute('href', 'https://docs.sentry.io');
      expect(element).toHaveAttribute('target', '_blank');
      expect(element).toHaveAttribute('rel', 'noreferrer noopener');
    });

    it('auto-detects protocol-relative URLs as external', () => {
      render(<Button href="//cdn.example.com/asset">Asset</Button>);

      const element = screen.getByRole('button', {name: 'Asset'});
      expect(element).toHaveAttribute('target', '_blank');
      expect(element).toHaveAttribute('rel', 'noreferrer noopener');
    });

    it('allows overriding openInNewTab=false for external URLs', () => {
      render(
        <Button href="https://docs.sentry.io" openInNewTab={false}>
          Docs
        </Button>
      );

      const element = screen.getByRole('button', {name: 'Docs'});
      expect(element).not.toHaveAttribute('target');
    });

    it('supports openInNewTab for internal URLs', () => {
      render(
        <Button href="/explore/logs" openInNewTab>
          Logs
        </Button>
      );

      const element = screen.getByRole('button', {name: 'Logs'});
      expect(element).toHaveAttribute('target', '_blank');
      expect(element).toHaveAttribute('rel', 'noreferrer noopener');
    });

    it('renders disabled navigation button without href', () => {
      render(
        <Button href="/settings" disabled>
          Settings
        </Button>
      );

      const element = screen.getByRole('button', {name: 'Settings'});
      expect(element).not.toHaveAttribute('href');
      expect(element).toHaveAttribute('aria-disabled', 'true');
    });

    it('does not call onClick on disabled navigation buttons', async () => {
      const spy = jest.fn();
      render(
        <Button href="/settings" disabled onClick={spy}>
          Settings
        </Button>
      );
      await userEvent.click(screen.getByRole('button', {name: 'Settings'}));

      expect(spy).not.toHaveBeenCalled();
    });

    it('renders icon-only navigation button with aria-label', () => {
      render(<Button href="https://docs.sentry.io" aria-label="Open docs" />);

      const element = screen.getByRole('button', {name: 'Open docs'});
      expect(element).toHaveAttribute('href', 'https://docs.sentry.io');
    });
  });
});

describe('LinkButton', () => {
  it('renders react-router link', () => {
    render(<LinkButton to="/some/route">Router Link</LinkButton>);
  });

  it('renders normal link', () => {
    render(<LinkButton href="/some/relative/url">Normal Link</LinkButton>);
    expect(screen.getByRole('button', {name: 'Normal Link'})).toHaveAttribute(
      'href',
      '/some/relative/url'
    );
  });

  it('renders disabled link', () => {
    render(
      <LinkButton disabled href="/some/relative/url">
        Disabled Link
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'Disabled Link'});

    expect(element).not.toHaveAttribute('href');
    expect(element).toHaveAttribute('aria-disabled', 'true');
  });

  it('renders external link with target="_blank" and security attributes', () => {
    render(
      <LinkButton href="https://example.com" external>
        External
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'External'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('renders internal link with target="_blank" when openInNewTab is set', () => {
    render(
      <LinkButton to="/some/route" openInNewTab>
        Open in Tab
      </LinkButton>
    );

    const element = screen.getByRole('button', {name: 'Open in Tab'});
    expect(element).toHaveAttribute('target', '_blank');
    expect(element).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('does not add target when openInNewTab is not set', () => {
    render(<LinkButton to="/some/route">Normal Route</LinkButton>);

    const element = screen.getByRole('button', {name: 'Normal Route'});
    expect(element).not.toHaveAttribute('target');
  });
});
