import {Fragment} from 'react';
import styled from '@emotion/styled';

import {ExternalLink} from '@sentry/scraps/link';
import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';

import {resolveHostname} from 'sentry/utils/api/resolveHostname';

import {COMMENT_ATTACHMENT_URL_PATTERN} from './commentAttachmentButton';

type Props = {
  text: string;
};

type MarkdownComponents = NonNullable<MarkdownProps['components']>;
type NoteLinkProps = React.ComponentProps<NonNullable<MarkdownComponents['Link']>>;

/**
 * Links to videos uploaded to the comment play inline, with the link kept
 * below the player so the file can still be opened directly.
 *
 * Both go to the region's host like other API requests: the browser loads
 * them itself, so they skip the API client, and the default link would treat
 * the `/api/0/` path as an in-app route.
 */
function NoteLink({Default, href, title, children}: NoteLinkProps) {
  if (!COMMENT_ATTACHMENT_URL_PATTERN.test(href)) {
    return (
      <Default href={href} title={title}>
        {children}
      </Default>
    );
  }
  const videoUrl = resolveHostname(href);
  return (
    <Fragment>
      <Video controls preload="metadata" src={videoUrl} data-test-id="note-video" />
      <ExternalLink href={videoUrl} title={title ?? undefined}>
        {children}
      </ExternalLink>
    </Fragment>
  );
}

const components: MarkdownComponents = {Link: NoteLink};

function NoteBody({text}: Props) {
  return (
    <div data-test-id="activity-note-body">
      <Markdown raw={text} components={components} />
    </div>
  );
}

const Video = styled('video')`
  display: block;
  max-width: 100%;
  max-height: 480px;
  border-radius: ${p => p.theme.radius.md};
  margin-bottom: ${p => p.theme.space.xs};
`;

export {NoteBody};
