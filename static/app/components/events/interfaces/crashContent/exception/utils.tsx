import {Fragment, ReactElement} from 'react';
import styled from '@emotion/styled';

// import {urlEncode} from '@sentry/utils';
import {openNavigateToExternalLinkModal} from 'sentry/actionCreators/modal';
import {Button} from 'sentry/components/button';
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
  if (!exceptionText) {
    return <Fragment />;
  }

  const urlRegex =
    /https?:\/\/(?:www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9]{1,6}\b(?:[-a-zA-Z0-9@:%_\+.~#?&\/=,\[\]]*)/gi;
  const parts = exceptionText.split(urlRegex);
  const urls = exceptionText.match(urlRegex) || [];

  const elements = parts.flatMap((part, index) => {
    const isUrlValid = urls[index] && isUrl(urls[index]);
    const link = isUrlValid ? (
      <Button
        key={`link-${index}`}
        priority="link"
        onClick={() => {
          const linkText = urls[index];
          openNavigateToExternalLinkModal({linkText});
        }}
      >
        {urls[index]}
        <IconPlacement size="xs" />
      </Button>
    ) : urls[index] ? (
      <span key={`invalid-url-${index}`}>{urls[index]}</span>
    ) : null;

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
