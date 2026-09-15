import {render, screen} from 'sentry-test/reactTestingLibrary';

import {IconDocs} from 'sentry/icons';

import {ResourceLink, resourceLinkMarkdown} from './resourceLink';

/**
 * Assembled rather than written out, because a `javascript:` literal is what
 * `no-script-url` exists to catch -- and refusing this href is the behaviour
 * under test.
 */
const SCRIPT_URL = ['javascript', 'alert(1)'].join(':');

function renderMarkdown(href: string, title: string) {
  const {container} = render(
    <ResourceLink icon={IconDocs} href={href} title={title} format="markdown" />
  );
  return container.textContent;
}

describe('resourceLinkMarkdown', () => {
  it('makes a site-relative href absolute, so a pasted link still resolves', () => {
    expect(resourceLinkMarkdown('/issues/JAVASCRIPT-22SP/', 'JAVASCRIPT-22SP')).toBe(
      `[JAVASCRIPT-22SP](${window.location.origin}/issues/JAVASCRIPT-22SP/)`
    );
  });

  it('leaves an off-site href alone', () => {
    expect(resourceLinkMarkdown('https://docs.sentry.io/product/issues/', 'Issues')).toBe(
      '[Issues](https://docs.sentry.io/product/issues/)'
    );
  });

  it('qualifies a same-origin absolute href rather than leaving it relative', () => {
    expect(resourceLinkMarkdown(`${window.location.origin}/issues/`, 'Issues')).toBe(
      `[Issues](${window.location.origin}/issues/)`
    );
  });

  it('keeps the query string and fragment the rendered link would navigate to', () => {
    expect(resourceLinkMarkdown('/issues/?query=is%3Aunresolved#top', 'Unresolved')).toBe(
      `[Unresolved](${window.location.origin}/issues/?query=is%3Aunresolved#top)`
    );
  });

  it('escapes brackets in a title rather than truncating the link text', () => {
    expect(resourceLinkMarkdown('/issues/', 'Errors [prod]')).toBe(
      `[Errors \\[prod\\]](${window.location.origin}/issues/)`
    );
  });

  it('wraps a destination containing parentheses, which would end it early', () => {
    expect(resourceLinkMarkdown('/issues/?query=(a) and (b)', 'Search')).toBe(
      `[Search](<${window.location.origin}/issues/?query=(a) and (b)>)`
    );
  });

  it.each([
    [SCRIPT_URL, 'a script url'],
    ['//evil.example.com/issues/', 'a protocol-relative url'],
    ['issues/1/', 'a bare relative path'],
  ])('renders nothing for %s (%s)', href => {
    expect(resourceLinkMarkdown(href, 'Nope')).toBeNull();
  });
});

describe('ResourceLink', () => {
  it('renders an anchor by default', () => {
    render(<ResourceLink icon={IconDocs} href="/issues/" title="Issues" />);

    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute(
      'href',
      '/issues/'
    );
  });

  it('keeps the anchor relative while the markdown beside it is absolute', () => {
    render(
      <ResourceLink
        icon={IconDocs}
        href={`${window.location.origin}/issues/`}
        title="Issues"
      />
    );

    expect(screen.getByRole('link', {name: 'Issues'})).toHaveAttribute(
      'href',
      '/issues/'
    );
    expect(renderMarkdown(`${window.location.origin}/issues/`, 'Issues')).toBe(
      `[Issues](${window.location.origin}/issues/)`
    );
  });

  it('renders markdown text, and no anchor, when asked for it', () => {
    const text = renderMarkdown('/issues/', 'Issues');

    expect(screen.queryByRole('link')).not.toBeInTheDocument();
    expect(text).toBe(`[Issues](${window.location.origin}/issues/)`);
  });

  it('refuses an unsafe href at both formats', () => {
    const {container: element} = render(
      <ResourceLink icon={IconDocs} href={SCRIPT_URL} title="Nope" />
    );

    expect(element).toBeEmptyDOMElement();
    expect(renderMarkdown(SCRIPT_URL, 'Nope')).toBe('');
  });
});
