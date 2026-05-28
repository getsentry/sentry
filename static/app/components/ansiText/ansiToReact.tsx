/**
 * This is vendored from ansi-to-react v6.2.6
 *
 * The link rendering was changed to use Sentry's external-link modal.
 *
 * Copyright (c) 2016, nteract contributors
 * All rights reserved.
 *
 * Redistribution and use in source and binary forms, with or without
 * modification, are permitted provided that the following conditions are met:
 *
 * 1. Redistributions of source code must retain the above copyright notice,
 *    this list of conditions and the following disclaimer.
 *
 * 2. Redistributions in binary form must reproduce the above copyright notice,
 *    this list of conditions and the following disclaimer in the documentation
 *    and/or other materials provided with the distribution.
 *
 * 3. Neither the name of nteract nor the names of its contributors may be used
 *    to endorse or promote products derived from this software without specific
 *    prior written permission.
 *
 * THIS SOFTWARE IS PROVIDED BY THE COPYRIGHT HOLDERS AND CONTRIBUTORS "AS IS"
 * AND ANY EXPRESS OR IMPLIED WARRANTIES, INCLUDING, BUT NOT LIMITED TO, THE
 * IMPLIED WARRANTIES OF MERCHANTABILITY AND FITNESS FOR A PARTICULAR PURPOSE ARE
 * DISCLAIMED. IN NO EVENT SHALL THE COPYRIGHT HOLDER OR CONTRIBUTORS BE LIABLE
 * FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY, OR CONSEQUENTIAL
 * DAMAGES (INCLUDING, BUT NOT LIMITED TO, PROCUREMENT OF SUBSTITUTE GOODS OR
 * SERVICES; LOSS OF USE, DATA, OR PROFITS; OR BUSINESS INTERRUPTION) HOWEVER
 * CAUSED AND ON ANY THEORY OF LIABILITY, WHETHER IN CONTRACT, STRICT LIABILITY,
 * OR TORT (INCLUDING NEGLIGENCE OR OTHERWISE) ARISING IN ANY WAY OUT OF THE USE
 * OF THIS SOFTWARE, EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGE.
 */
import type {CSSProperties, ReactElement, ReactNode} from 'react';
import {Fragment, useMemo} from 'react';
import {type Theme, useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import Anser from 'anser';
import type {AnserJsonEntry} from 'anser';

import {ExternalLink} from '@sentry/scraps/link';

import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {IconOpen} from 'sentry/icons';
import {isValidUrl} from 'sentry/utils/string/isValidUrl';

type AnsiToReactProps = {
  text: string;
};

const ESCAPE_CHARACTER = '\u001B';

export function AnsiToReact({text}: AnsiToReactProps): ReactElement {
  if (!text.includes(ESCAPE_CHARACTER)) {
    return <Fragment>{renderLinksInPlainText(text, 'plain')}</Fragment>;
  }

  return <AnsiSpans text={text} />;
}

function AnsiSpans({text}: AnsiToReactProps): ReactElement {
  const theme = useTheme();
  const bundles = useMemo(
    () =>
      Anser.ansiToJson(text, {
        json: true,
        remove_empty: true,
        use_classes: true,
      }),
    [text]
  );

  return (
    <Fragment>
      {bundles.map((bundle, index) => (
        <span key={index} style={getAnsiStyle(bundle, theme)}>
          {renderLinksInPlainText(bundle.content, `ansi-${index}`)}
        </span>
      ))}
    </Fragment>
  );
}

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
// Links are rendered as React nodes so ANSI text never needs HTML injection.
const URL_REGEX =
  /https?:\/\/(?:www\.)?[-\w@:%.+~#=]{1,256}\.[a-z0-9]{1,6}(?:[-\w@:%+~#?&/=,[\].]*[-\w@:%+~#?&/=,[\]])?/gi;

function renderLinksInPlainText(text: string, keyPrefix: string): ReactNode {
  if (!text.includes('http://') && !text.includes('https://')) {
    return text;
  }

  const elements: ReactNode[] = [];
  let lastIndex = 0;
  let hasLink = false;

  for (const match of text.matchAll(URL_REGEX)) {
    const url = match[0];
    const index = match.index ?? 0;
    hasLink = true;

    if (index > lastIndex) {
      elements.push(
        <Fragment key={`${keyPrefix}-text-${lastIndex}`}>
          {text.slice(lastIndex, index)}
        </Fragment>
      );
    }

    if (isValidUrl(url)) {
      elements.push(
        <ExternalLink
          key={`${keyPrefix}-link-${index}`}
          onClick={event => {
            event.preventDefault();
            openNavigateToExternalLinkModal({linkText: url});
          }}
        >
          {url}
          <IconPlacement size="xs" />
        </ExternalLink>
      );
    } else {
      elements.push(<span key={`${keyPrefix}-invalid-url-${index}`}>{url}</span>);
    }

    lastIndex = index + url.length;
  }

  if (!hasLink) {
    return text;
  }

  if (lastIndex < text.length) {
    elements.push(
      <Fragment key={`${keyPrefix}-text-${lastIndex}`}>{text.slice(lastIndex)}</Fragment>
    );
  }

  return elements;
}

function getAnsiStyle(bundle: AnserJsonEntry, theme: Theme): CSSProperties | undefined {
  const style: CSSProperties = {};
  const color = getAnsiColor(bundle.fg, bundle.fg_truecolor, theme);
  const backgroundColor = getAnsiColor(bundle.bg, bundle.bg_truecolor, theme);

  if (bundle.decoration === 'reverse') {
    if (backgroundColor) {
      style.color = backgroundColor;
    }
    if (color) {
      style.backgroundColor = color;
    }
  } else {
    if (color) {
      style.color = color;
    }
    if (backgroundColor) {
      style.backgroundColor = backgroundColor;
    }
  }

  switch (bundle.decoration) {
    case 'bold':
      style.fontWeight = 'bold';
      break;
    case 'dim':
      style.opacity = 0.65;
      break;
    case 'italic':
      style.fontStyle = 'italic';
      break;
    case 'underline':
      style.textDecorationLine = 'underline';
      break;
    case 'hidden':
      style.visibility = 'hidden';
      break;
    case 'strikethrough':
      style.textDecorationLine = 'line-through';
      break;
    case 'blink':
    case 'reverse':
    case null:
      break;
    default:
      break;
  }

  return Object.keys(style).length > 0 ? style : undefined;
}

function getAnsiColor(
  colorClass: string | null,
  trueColor: string | null,
  theme: Theme
): string | undefined {
  if (!colorClass) {
    return undefined;
  }

  if (colorClass === 'ansi-truecolor' && trueColor) {
    return `rgb(${trueColor})`;
  }

  if (colorClass.startsWith('ansi-bright-')) {
    return getThemeAnsiColor(colorClass.replace('ansi-bright-', ''), theme, true);
  }

  if (colorClass.startsWith('ansi-')) {
    return getThemeAnsiColor(colorClass.replace('ansi-', ''), theme);
  }

  return undefined;
}

function getThemeAnsiColor(
  colorName: string,
  theme: Theme,
  bright = false
): string | undefined {
  if (colorName === 'black' || colorName === 'white') {
    return theme.colors[colorName];
  }

  const themeColorName = COLOR_MAP[colorName as keyof typeof COLOR_MAP];
  if (!themeColorName) {
    return undefined;
  }

  const themeColorWeight = bright ? '200' : '500';
  return theme.colors[`${themeColorName}${themeColorWeight}`];
}

/**
 * Maps ANSI color names -> theme.tsx color names
 */
const COLOR_MAP = {
  red: 'red',
  green: 'green',
  blue: 'blue',
  yellow: 'yellow',
  magenta: 'pink',
  cyan: 'blue',
} as const;

const IconPlacement = styled(IconOpen)`
  display: inline-block;
  margin-left: 5px;
  vertical-align: center;
`;
