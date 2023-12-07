import {Component, Fragment} from 'react';
import {urlEncode} from '@sentry/utils';

interface ExternalRedirectProps {
  exceptionText: string;
}

interface ExternalRedirectState {
  isRedirecting: boolean;
  redirectUrl: string;
}

class ExternalRedirect extends Component<ExternalRedirectProps, ExternalRedirectState> {
  constructor(props) {
    super(props);
    this.state = {
      isRedirecting: false,
      redirectUrl: '',
    };
  }

  handleLinkClick = url => {
    this.setState({
      redirectUrl: url,
      isRedirecting: true,
    });
  };

  render() {
    const {exceptionText} = this.props;
    // const {isRedirecting, redirectUrl} = this.state;

    if (!exceptionText) {
      return <Fragment />;
    }

    const urlRegex =
      /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/=,\[\]]*)/gi;
    // https?: Matches both "http" and "https"
    // :\/\/: This is a literal match for "://"
    // (?:www\.)?: Matches URLs with or without "www."
    // [-a-zA-Z0-9@:%._\+~#=]{1,256}: Matches the domain name
    //    It allows for a range of characters (letters, digits, and special characters)
    //    The {1,256} specifies that these characters can occur anywhere from 1 to 256 times, which covers the range of typical domain name lengths
    // \.: Matches the dot before the top-level domain (like ".com")
    // [a-zA-Z0-9]{1,6}: Matches the top-level domain (like "com" or "org"). It's limited to letters and digits and can be between 1 and 6 characters long
    // \b: Marks the end of the domain part of the URL
    // (?:[-a-zA-Z0-9@:%_\+.~#?&\/=,\[\]]*): Matches the path or query parameters that can follow the domain in a URL
    //    It includes a wide range of characters typically found in paths and query strings
    // /gi: The regex will match all occurrences in the string, not just the first one
    //    i makes the regex match both upper and lower case characters;
    const parts = exceptionText.split(urlRegex);
    const urls = exceptionText.match(urlRegex);

    const elements = parts.flatMap((part, index) => {
      const link =
        urls && urls[index] ? (
          <a
            key={`link-${index}`}
            href={`${window.location.origin}/redirect?${urlEncode({
              url: urls[index],
            })}`}
            onClick={() => this.handleLinkClick(urls[index])}
            target="_blank"
            rel="noreferrer"
          >
            {urls[index]}
          </a>
        ) : null;

      return [<Fragment key={`text-${index}`}>{part}</Fragment>, link];
    });

    return <Fragment>{elements}</Fragment>;
  }
}

export default ExternalRedirect;
