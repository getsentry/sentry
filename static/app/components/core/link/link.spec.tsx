import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ExternalLink, Link} from 'sentry/components/core/link';

describe('Link', () => {
  // Note: Links should not support a disabled option, as disabled links are just text elements
  it('disabled links render as <a> with no href', () => {
    render(
      <Link disabled to="https://www.sentry.io/">
        Link
      </Link>
    );

    expect(screen.getByText('Link')).toBeEnabled();
    expect(screen.getByText('Link')).not.toHaveAttribute('href');
  });

  it('links render as <a> with href', () => {
    render(<Link to="https://www.sentry.io/">Link</Link>);
    expect(screen.getByText('Link')).toHaveAttribute('href', 'https://www.sentry.io/');
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
