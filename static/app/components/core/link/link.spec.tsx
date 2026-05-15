import {render, screen} from 'sentry-test/reactTestingLibrary';

import {ExternalLink, Link} from '@sentry/scraps/link';

describe('Link', () => {
  describe('with `to` prop (legacy)', () => {
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
  });

  describe('with `href` prop', () => {
    it('renders external URLs as <a> with target="_blank" and rel by default', () => {
      render(<Link href="https://docs.sentry.io">Docs</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://docs.sentry.io');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    });

    it('renders external URLs in same tab when openInNewTab is false', () => {
      render(
        <Link href="https://docs.sentry.io" openInNewTab={false}>
          Docs
        </Link>
      );

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'https://docs.sentry.io');
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });

    it('renders http:// URLs as external', () => {
      render(<Link href="http://example.com">Example</Link>);

      const link = screen.getByRole('link');
      expect(link).toHaveAttribute('href', 'http://example.com');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noreferrer noopener');
    });

    it('renders internal string paths through React Router', () => {
      render(<Link href="/organizations/sentry/issues/">Issues</Link>);

      const link = screen.getByText('Issues');
      expect(link).toHaveAttribute('href', '/organizations/sentry/issues/');
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });

    it('renders LocationDescriptor objects as internal links', () => {
      render(<Link href={{pathname: '/settings/account/'}}>Settings</Link>);

      const link = screen.getByText('Settings');
      expect(link).toHaveAttribute('href', '/settings/account/');
      expect(link).not.toHaveAttribute('target');
      expect(link).not.toHaveAttribute('rel');
    });

    it('renders disabled links with no href', () => {
      render(
        <Link href="https://docs.sentry.io" disabled>
          Docs
        </Link>
      );

      expect(screen.getByText('Docs')).not.toHaveAttribute('href');
      expect(screen.getByText('Docs')).not.toHaveAttribute('target');
    });
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
