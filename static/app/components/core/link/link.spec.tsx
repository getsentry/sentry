import {render, screen, userEvent} from 'sentry-test/reactTestingLibrary';

import {ExternalLink, Link} from '@sentry/scraps/link';
import {TrackingContextProvider} from '@sentry/scraps/trackingContext';

function renderWithTracking(ui: React.ReactElement) {
  const tracking = jest.fn();
  function TrackingWrapper({children}: {children: React.ReactNode}) {
    return (
      <TrackingContextProvider value={() => tracking}>{children}</TrackingContextProvider>
    );
  }

  return {tracking, ...render(ui, {additionalWrapper: TrackingWrapper})};
}

describe('Link', () => {
  // Note: Links should not support a disabled option, as disabled links are just text elements

  describe('disabled links', () => {
    it('renders links with string to prop render as <a> with no href', () => {
      render(
        // eslint-disable-next-line no-restricted-syntax
        <Link disabled to="https://www.sentry.io/">
          Link
        </Link>
      );

      expect(screen.getByText('Link')).toBeEnabled();
      expect(screen.getByText('Link')).not.toHaveAttribute('href');
    });

    it('renders links with LocationDescriptor to prop render as <a> with no href', () => {
      render(
        <Link disabled to={{pathname: '/settings/account/'}}>
          Link
        </Link>
      );

      expect(screen.getByText('Link')).toBeEnabled();
      expect(screen.getByText('Link')).not.toHaveAttribute('href');
    });
  });

  it('links render as <a> with href', () => {
    // eslint-disable-next-line no-restricted-syntax
    render(<Link to="https://www.sentry.io/">Link</Link>);
    expect(screen.getByText('Link')).toHaveAttribute('href', 'https://www.sentry.io/');
  });

  it('uses the link text as the tracking label', async () => {
    const {tracking} = renderWithTracking(<Link to="/some/route">Open</Link>);
    await userEvent.click(screen.getByRole('link', {name: 'Open'}));

    expect(tracking).toHaveBeenCalledWith(
      expect.objectContaining({'aria-label': 'Open'})
    );
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
