import type {ReactElement} from 'react';
import {Fragment} from 'react';
import styled from '@emotion/styled';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {ExternalLink} from 'sentry/components/core/link';
import {IconOpen} from 'sentry/icons';
import {isUrl} from 'sentry/utils/string/isUrl';

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
  // (?:[-a-zA-Z0-9@:%_\+~#?&\/=,\[\].]*[-a-zA-Z0-9@:%_\+~#?&\/=,\[\]])?: Matches the path, query parameters, or fragments that can follow the domain in a URL
  //    It now includes periods within the character set to allow for file extensions (e.g., ".html") and other period-containing segments in the URL path
  //    This pattern matches a wide range of characters typically found in paths, query strings, and fragments, including periods
  //    The final character set ensures that the URL ends with a character typically allowed in a path, query string, or fragment, excluding special characters like a trailing period not part of the URL
  // /gi: The regex will match all occurrences in the string, not just the first one
  //    The "i" modifier makes the regex match both upper and lower case characters

  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}(?:[-a-zA-Z0-9@:%_\+~#?&\/=,\[\].]*[-a-zA-Z0-9@:%_\+~#?&\/=,\[\]])?/gi;

  const parts = exceptionText.split(urlRegex);
  const urls = exceptionText.match(urlRegex) || [];

  const elements = parts.flatMap((part, index) => {
    const url = urls[index]!;
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
  'sentry.javascript.aws-serverless': 'aws-lambda',
  'sentry.javascript.browser': 'javascript',
  'sentry.javascript.node': 'node',
  'sentry.javascript.node.hapi': 'hapi',
  'sentry.javascript.react': 'react',
  'sentry.javascript.angular': 'angular',
  'sentry.javascript.angular-ivy': 'angular',
  'sentry.javascript.bun': 'bun',
  'sentry.javascript.capacitor': 'capacitor',
  'sentry.javascript.cloudflare': 'cloudflare',
  'sentry.javascript.cordova': 'cordova',
  'sentry.javascript.deno': 'deno',
  'sentry.javascript.electron': 'electron',
  'sentry.javascript.ember': 'ember',
  'sentry.javascript.gatsby': 'gatsby',
  'sentry.javascript.google-cloud-serverless': 'gcp-functions',
  'sentry.javascript.vue': 'vue',
  'sentry.javascript.nestjs': 'nestjs',
  'sentry.javascript.nextjs': 'nextjs',
  'sentry.javascript.nuxt': 'nuxt',
  'sentry.javascript.remix': 'remix',
  'sentry.javascript.solid': 'solid',
  'sentry.javascript.solid-start': 'solidstart',
  'sentry.javascript.svelte': 'svelte',
  'sentry.javascript.sveltekit': 'sveltekit',
  'sentry.javascript.react-native': 'react-native',
  'sentry.javascript.astro': 'astro',
};

const IconPlacement = styled(IconOpen)`
  display: inline-block;
  margin-left: 5px;
  vertical-align: center;
`;
