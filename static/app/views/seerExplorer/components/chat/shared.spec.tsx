import {render, screen} from 'sentry-test/reactTestingLibrary';

import {SeerMarkdown} from 'sentry/views/seerExplorer/components/chat/shared';

describe('SeerMarkdown docs-link tag', () => {
  it('renders a link from the JSON body', () => {
    render(
      <SeerMarkdown raw='{% docs-link %}{"url": "https://docs.sentry.io/product/issues/", "title": "Issues"}{% /docs-link %}' />
    );
    const link = screen.getByRole('link', {name: 'Issues'});
    expect(link).toHaveAttribute('href', 'https://docs.sentry.io/product/issues/');
    expect(link).toHaveAttribute('target', '_blank');
  });

  it('accepts opening-tag attrs as a fallback', () => {
    render(
      <SeerMarkdown raw='{% docs-link url="https://docs.sentry.io/platforms/" title="Platforms" /%}' />
    );
    expect(screen.getByRole('link', {name: 'Platforms'})).toHaveAttribute(
      'href',
      'https://docs.sentry.io/platforms/'
    );
  });

  it('ignores links to non-docs hosts', () => {
    render(
      <SeerMarkdown raw='{% docs-link %}{"url": "https://evil.example.com/", "title": "Nope"}{% /docs-link %}' />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });

  it('ignores an entry with no url', () => {
    render(
      <SeerMarkdown raw='{% docs-link %}{"title": "Missing url"}{% /docs-link %}' />
    );
    expect(screen.queryByRole('link')).not.toBeInTheDocument();
  });
});
