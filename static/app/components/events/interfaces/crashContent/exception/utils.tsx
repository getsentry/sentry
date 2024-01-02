import {Fragment, ReactElement} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import ExternalLink from 'sentry/components/links/externalLink';
import {IconOpen} from 'sentry/icons';
import type {Frame} from 'sentry/types';
import {isUrl} from 'sentry/utils';
import {getFileExtension} from 'sentry/utils/fileExtension';

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

interface RenderLinksInTextProps {
  exceptionText: string;
}

export const renderLinksInText = ({
  exceptionText,
}: RenderLinksInTextProps): ReactElement => {
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
  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/=,\[\]]*)/gi;
  const parts = exceptionText.split(urlRegex);
  const urls = exceptionText.match(urlRegex) || [];

  const elements = parts.flatMap((part, index) => {
    const url = urls[index];
    const isUrlValid = isUrl(url);

    let link: ReactElement | undefined;
    if (isUrlValid) {
      link = (
        <ExternalLink
          key={`link-${index}`}
          onClick={e => {
            e.preventDefault();
            openNavigateToExternalLinkModal({linkText: url});
          }}
        >
          {url}
          <IconPlacement size="xs" />
        </ExternalLink>
      );
    } else if (url) {
      link = <span key={`invalid-url-${index}`}>{url}</span>;
    }

    return [<Fragment key={`text-${index}`}>{part}</Fragment>, link];
  });

  return <Fragment>{elements}</Fragment>;
};

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

const IconPlacement = styled(IconOpen)`
  display: inline-block;
  margin-left: 5px;
  vertical-align: center;
`;
