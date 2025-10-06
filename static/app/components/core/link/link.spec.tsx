import {act, render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExternalLink, Link} from 'sentry/components/core/link';
import {FrontendVersionProvider} from 'sentry/components/frontendVersionContext';

describe('Link', () => {
  // Note: Links should not support a disabled option, as disabled links are just text elements
  it('disabled links render as <a> with no href', () => {
    render(
      // eslint-disable-next-line no-restricted-syntax
      <Link disabled to="https://www.sentry.io/">
        Link
      </Link>
    );

    expect(screen.getByText('Link')).toBeEnabled();
    expect(screen.getByText('Link')).not.toHaveAttribute('href');
  });

  it('links render as <a> with href', () => {
    // eslint-disable-next-line no-restricted-syntax
    render(<Link to="https://www.sentry.io/">Link</Link>);
    expect(screen.getByText('Link')).toHaveAttribute('href', 'https://www.sentry.io/');
  });

  it('links do not do a full page reload when the frontend version is current', async () => {
    const {router} = render(
      <FrontendVersionProvider releaseVersion="frontend@abc123" force="current">
        <Link to="/issues/">Link</Link>
      </FrontendVersionProvider>
    );

    // Normal router navigation
    await userEvent.click(screen.getByRole('link'));
    expect(router.location.pathname).toBe('/issues/');
  });

  it('links do NOT do full page reload when frontend is outdated and reloadIfStale is false', async () => {
    const {router} = render(
      <FrontendVersionProvider releaseVersion="frontend@abc123" force="stale">
        <Link to="/issues/">Link</Link>
      </FrontendVersionProvider>
    );

    // Normal router navigation even when stale
    await userEvent.click(screen.getByRole('link'));
    expect(router.location.pathname).toBe('/issues/');
  });

  it('links do full page reload when frontend is outdated and reloadIfStale is true', () => {
    render(
      <FrontendVersionProvider releaseVersion="frontend@abc123" force="stale">
        <Link to="/issues/" reloadIfStale>
          Link
        </Link>
      </FrontendVersionProvider>
    );

    const link = screen.getByRole('link');

    const event = new MouseEvent('click', {
      view: window,
      bubbles: true,
      cancelable: true,
    });
    act(() => link.dispatchEvent(event));

    // react router did not prevent default, the link was clicked as normal
    expect(event.defaultPrevented).toBe(false);
  });
});

describe('ExternalLink', () => {
  it('external links render as <a> with target="_blank" and rel="noreferrer noopener" if openInNewTab is true', () => {
    render(<ExternalLink href="https://www.sentry.io/">ExternalLink</ExternalLink>);

    expect(screen.getByRole('link')).toHaveAttribute('target', '_blank');
    expect(screen.getByRole('link')).toHaveAttribute('rel', 'noreferrer noopener');
  });

  it('external links render as <a> with href if openInNewTab is false', () => {
    render(
      <ExternalLink href="https://www.sentry.io/" openInNewTab={false}>
        ExternalLink
      </ExternalLink>
    );

    expect(screen.getByRole('link')).toHaveAttribute('href', 'https://www.sentry.io/');
    expect(screen.getByRole('link')).not.toHaveAttribute('target');
    expect(screen.getByRole('link')).not.toHaveAttribute('rel');
  });
});
