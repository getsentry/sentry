import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Markdown, type MarkdownProps} from '@sentry/scraps/markdown';

import {COMMENT_ATTACHMENT_URL_PATTERN} from './commentAttachmentButton';

type Props = {
  text: string;
};

type MarkdownComponents = NonNullable<MarkdownProps['components']>;
type NoteLinkProps = React.ComponentProps<NonNullable<MarkdownComponents['Link']>>;

/**
 * Links to videos uploaded to the comment play inline, with the link kept
 * below the player so the file can still be opened directly.
 */
function NoteLink({Default, href, title, children}: NoteLinkProps) {
  const link = (
    <Default href={href} title={title}>
      {children}
    </Default>
  );
  if (!COMMENT_ATTACHMENT_URL_PATTERN.test(href)) {
    return link;
  }
  return (
    <Fragment>
      <Video controls preload="metadata" src={href} data-test-id="note-video" />
      {link}
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
