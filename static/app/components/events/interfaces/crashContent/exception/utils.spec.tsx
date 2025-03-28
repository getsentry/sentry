import {render, screen} from 'sentry-test/reactTestingLibrary';

import {
  isFailedToFetchException,
  renderLinksInText,
} from 'sentry/components/events/interfaces/crashContent/exception/utils';

describe('Linkify()', function () {
  it('does not alter text that does not contain urls', function () {
    const text = 'This is not a link';
    const {container} = render(renderLinksInText({exceptionText: text}));

    expect(screen.getByText(text)).toBeInTheDocument();

    // check if the text is directly within the container (which implies a fragment)
    expect(container.firstChild).toHaveTextContent(text);
  });

  it('applies links to text containing a single url and text', function () {
    // fix
    const url = 'https://www.example.com';
    const text = `Go to ${url} to search.`;

    render(
      renderLinksInText({
        exceptionText: text,
      })
    );

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();
  });

  it('applies link to text containing a single url', function () {
    const url = 'https://www.example.com';

    render(renderLinksInText({exceptionText: url}));

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();
  });

  it('applies links to text containing multiple urls', function () {
    const url_1 = 'https://www.example.com';
    const url_2 = 'https://docs.sentry.io';
    const text = `Go to ${url_1} to search and ${url_2} for docs.`;
    const {container} = render(renderLinksInText({exceptionText: text}));

    const linkElement = screen.getByText(url_1);
    expect(linkElement).toBeInTheDocument();

    const linkElement_2 = screen.getByText(url_2);
    expect(linkElement_2).toBeInTheDocument();

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('applies links to text containing complex urls with query parameters and hashes', function () {
    const url = 'https://www.example.com/search?query=linkify&sort=recent#section2';
    const text = `Go to ${url}`;
    const {container} = render(renderLinksInText({exceptionText: text}));

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('handles text containing uls of non-supported schemes', function () {
    const url = 'ftp://myname:hello@lenny/lucky.png';
    const text = `Go to ${url}`;
    const {container} = render(renderLinksInText({exceptionText: text}));

    const textElement = screen.getByText(text);
    expect(textElement).toBeInTheDocument();

    // check if the text is directly within the container
    expect(container.firstChild).toHaveTextContent(text);
  });

  it('applies links to text containing urls at the start or end', function () {
    const url_1 = 'https://www.example.com';
    const url_2 = 'https://docs.sentry.io';
    const text = `${url_1} and ${url_2}`;
    render(renderLinksInText({exceptionText: text}));

    const linkElement = screen.getByText(url_1);
    expect(linkElement).toBeInTheDocument();

    const linkElement_2 = screen.getByText(url_2);
    expect(linkElement_2).toBeInTheDocument();
  });

  it('applies links to long text containing urls', function () {
    const url = 'https://www.example.com';
    const longString = 'a b c d e f g h i j k l m n o p'.repeat(1000);
    const text = `Go to ${url} ${longString}`;
    const {container} = render(renderLinksInText({exceptionText: text}));

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('handles html/special characters in text input', function () {
    const url = 'https://www.example.com';
    const textWithHtml = `Check out this link: <a href="${url}">${url}</a> & don\'t forget to visit us!`;
    const {container} = render(renderLinksInText({exceptionText: textWithHtml}));

    const linkElements = screen.getAllByText(url);
    expect(linkElements).toHaveLength(2);

    expect(container).toHaveTextContent(textWithHtml);
  });

  it('applies links to text containing urls of mixed casing', function () {
    const url = 'https://ExAmPlE.com';
    const text = `Go to ${url}`;
    const {container} = render(renderLinksInText({exceptionText: text}));

    const linkElement = screen.getByText(url);

    expect(linkElement).toBeInTheDocument();

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('applies links to text containing a single url and text and ignores a period', function () {
    // fix
    const url = 'https://www.example.com';
    const text = `Go to ${url}.`;

    render(
      renderLinksInText({
        exceptionText: text,
      })
    );

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();
  });

  it('applies links to text containing a single url that has a period inside', function () {
    // fix
    const url = 'https://www.example.com/page.html';
    const text = `Go to ${url}`;

    render(
      renderLinksInText({
        exceptionText: text,
      })
    );

    const linkElement = screen.getByText(url);
    expect(linkElement).toBeInTheDocument();
  });
});

describe('isFailedToFetchException', () => {
  // Chromium case
  it('returns true for TypeError with Chromium "Failed to fetch" message', () => {
    expect(isFailedToFetchException('TypeError', 'Failed to fetch')).toBe(true);
    expect(isFailedToFetchException('TypeError', 'Failed to fetch (plausible.io)')).toBe(
      true
    );
  });

  // WebKit case
  it('returns true for TypeError with WebKit "Load failed" message', () => {
    expect(isFailedToFetchException('TypeError', 'Load failed')).toBe(true);
    expect(isFailedToFetchException('TypeError', 'Load failed (plausible.io)')).toBe(
      true
    );
  });

  // Test Firefox case
  it('returns true for TypeError with Firefox network error message', () => {
    expect(
      isFailedToFetchException(
        'TypeError',
        'NetworkError when attempting to fetch resource.'
      )
    ).toBe(true);
    expect(
      isFailedToFetchException(
        'TypeError',
        'NetworkError when attempting to fetch resource. (lausible.io)'
      )
    ).toBe(true);
  });

  it('returns false for non-TypeError exceptions', () => {
    expect(isFailedToFetchException('Error', 'Failed to fetch')).toBe(false);
  });

  it('returns false for TypeError with different message', () => {
    expect(isFailedToFetchException('TypeError', 'Cannot read property')).toBe(false);
    expect(isFailedToFetchException('TypeError', 'null is not an object')).toBe(false);
    expect(isFailedToFetchException('TypeError', 'undefined is not a function')).toBe(
      false
    );
    expect(isFailedToFetchException('TypeError', 'Error: Failed to fetch')).toBe(false);
    expect(isFailedToFetchException('TypeError', 'Error when Load failed')).toBe(false);
    expect(
      isFailedToFetchException(
        'TypeError',
        'Error: NetworkError when attempting to fetch resource.'
      )
    ).toBe(false);
  });

  it('handles empty values appropriately', () => {
    expect(isFailedToFetchException('TypeError', '')).toBe(false);
    expect(isFailedToFetchException('', 'Failed to fetch')).toBe(false);
    expect(isFailedToFetchException('', '')).toBe(false);
  });
});
