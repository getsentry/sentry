import {Fragment, ReactElement, ReactNode, useEffect, useState} from 'react';

import type {Frame} from 'sentry/types';
import {getFileExtension} from 'sentry/utils/fileExtension';
import {useNavigate} from 'sentry/utils/useNavigate';

const fileNameBlocklist = ['@webkit-masked-url'];
export function isFrameFilenamePathlike(frame: Frame): boolean {
  let filename = frame.absPath ?? '';
  try {
    filename = new URL(filename).pathname.split('/').reverse()[0];
  } catch {
    // do nothing
  }

  return (
    // If all filenames are anonymous, we do not want to show this alert
    (frame.filename === '<anonymous>' && frame.inApp) ||
    // If all function names are on the blocklist, we do not want to show this alert
    fileNameBlocklist.includes(frame.function ?? '') ||
    // If all absolute paths do not have a file extension, we do not want to show this alert
    (!!frame.absPath && !getFileExtension(filename))
  );
}

// Detects URLs in text and renders them with anchor tags
export function Linkify({exceptionText}: {exceptionText?: string}): ReactElement {
  const [isOpen, setIsOpen] = useState(false);

  function handleExternalLink() {
    setIsOpen(true);
  }

  if (!exceptionText) {
    return <Fragment>{''}</Fragment>;
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
  //    i makes the regex match both upper and lower case characters

  const parts = exceptionText.split(urlRegex);
  const urls = exceptionText.match(urlRegex);

  const elements: ReactNode[] = parts.flatMap((part, index) => {
    const link =
      urls && urls[index] ? (
        <Fragment>
          <a
            href={window.location.href + '/redirect'}
            target="_blank"
            rel="noopener noreferrer"
            onClick={handleExternalLink}
          >
            {urls[index]}
          </a>
          {isOpen && <RedirectExternalLink externalUrl={urls[index]} />}
        </Fragment>
      ) : null;

    // Combine the text part and its following URL into a React Fragment
    // Each part of the text and each link is given a unique key for React's rendering optimization
    return [<Fragment key={`text-${index}`}>{part}</Fragment>, link];
  });

  return <Fragment>{elements}</Fragment>;
}

interface Props {
  externalUrl: string;
}

function RedirectExternalLink({externalUrl}: Props) {
  // State to control redirect
  const [count, setCount] = useState(5);
  const navigate = useNavigate();

  // Redirect after timer
  useEffect(() => {
    const timer = setInterval(() => {
      setCount(count - 1);
    }, 1000);

    if (count === 0) {
      window.open(externalUrl, '_blank');
    }

    return () => clearInterval(timer);
  }, [count, externalUrl]);

  return (
    <Fragment>
      <title>See You Later</title>

      <p>
        You are leaving Sentry and will be automatically redirected to {externalUrl} in{' '}
        {count} seconds. Changed your mind?{' '}
        <a onClick={() => navigate(-1)}>Go back to Sentry</a>
      </p>
    </Fragment>
  );
}

// // Usage
// <RedirectTab redirectUrl="https://external-url.com" domain="https://mydomain.com" />;

// Maps the SDK name to the url token for docs
export const sourceMapSdkDocsMap: Record<string, string> = {
  'sentry.javascript.browser': 'javascript',
  'sentry.javascript.node': 'node',
  'sentry.javascript.react': 'react',
  'sentry.javascript.angular': 'angular',
  'sentry.javascript.angular-ivy': 'angular',
  'sentry.javascript.ember': 'ember',
  'sentry.javascript.gatsby': 'gatsby',
  'sentry.javascript.vue': 'vue',
  'sentry.javascript.nextjs': 'nextjs',
  'sentry.javascript.remix': 'remix',
  'sentry.javascript.svelte': 'svelte',
  'sentry.javascript.sveltekit': 'sveltekit',
  'sentry.javascript.react-native': 'react-native',
  'sentry.javascript.atro': 'astro',
};
