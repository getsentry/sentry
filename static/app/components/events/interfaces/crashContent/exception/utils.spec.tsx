import {render} from 'sentry-test/reactTestingLibrary';

import {Linkify} from 'sentry/components/events/interfaces/crashContent/exception/utils';

describe('Linkify()', function () {
  it('does not alter text that does not contain urls', function () {
    const text = 'This is not a link';
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    expect(getByText(text)).toBeInTheDocument();

    // check if the text is directly within the container (which implies a fragment)
    expect(container.firstChild).toHaveTextContent(text);
  });

  it('returns an empty string when no text is provided', function () {
    const text = '';
    const {container} = render(<Linkify exceptionText={text} />);

    expect(container.firstChild).toHaveTextContent(text);
  });

  it('applies links to text containing a single url', function () {
    const url = 'https://www.example.com';
    const text = `Go to ${url} to search.`;
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    const linkElement = getByText(url);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url);

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('applies links to text containing multiple urls', function () {
    const url_1 = 'https://www.example.com';
    const url_2 = 'https://docs.sentry.io';
    const text = `Go to ${url_1} to search and ${url_2} for docs.`;
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    const linkElement = getByText(url_1);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url_1);

    const linkElement_2 = getByText(url_2);
    expect(linkElement_2).toBeInTheDocument();
    expect(linkElement_2).toHaveAttribute('href', url_2);

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('applies links to text containing complex urls with query parameters and hashes', function () {
    const url = 'https://www.example.com/search?query=linkify&sort=recent#section2';
    const text = `Go to ${url}`;
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    const linkElement = getByText(url);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url);

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('handles text containing uls of non-supported schemes', function () {
    const url = 'ftp://myname:hello@lenny/lucky.png';
    const text = `Go to ${url}`;
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    expect(getByText(text)).toBeInTheDocument();

    // check if the text is directly within the container
    expect(container.firstChild).toHaveTextContent(text);
  });

  it('applies links to text containing urls at the start or end', function () {
    const url_1 = 'https://www.example.com';
    const url_2 = 'https://docs.sentry.io';
    const text = `${url_1} and ${url_2}`;
    const {getByText} = render(<Linkify exceptionText={text} />);

    const linkElement = getByText(url_1);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url_1);

    const linkElement_2 = getByText(url_2);
    expect(linkElement_2).toBeInTheDocument();
    expect(linkElement_2).toHaveAttribute('href', url_2);
  });

  it('applies links to long text containing urls', function () {
    const url = 'https://www.example.com';
    const longString = 'a b c d e f g h i j k l m n o p'.repeat(1000);
    const text = `Go to ${url} ${longString}`;
    const {container, getByText} = render(<Linkify exceptionText={text} />);

    const linkElement = getByText(url);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url);

    expect(container.firstChild).toHaveTextContent('Go to');
  });

  it('handles html/special characters in text input', function () {
    const textWithHtml =
      'Check out this link: <a href="https://www.example.com">https://www.example.com</a> & don\'t forget to visit us!';
    const {container} = render(<Linkify exceptionText={textWithHtml} />);

    expect(container).toHaveTextContent(textWithHtml);
  });

  it('applies links to text containing urls of mixed casing', function () {
    const url = 'Http://ExAmPlE.com';
    const mixedCaseText = `check this link: ${url}`;
    const {container, getByText} = render(<Linkify exceptionText={mixedCaseText} />);
    const linkElement = getByText(url);
    expect(linkElement).toBeInTheDocument();
    expect(linkElement).toHaveAttribute('href', url);

    expect(container.firstChild).toHaveTextContent('check this link:');
  });
});
