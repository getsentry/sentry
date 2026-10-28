import {parseAsString, parseAsStringLiteral} from 'nuqs';

import type {InvestigationComment} from 'sentry/views/investigations/types';

export const COMMENTS_DRAWER_PARSERS = {
  comments: parseAsStringLiteral(['open']),
  commentsBlock: parseAsString,
  comment: parseAsString,
};

export function isCommentEdited(comment: InvestigationComment) {
  return (
    new Date(comment.dateUpdated).getTime() > new Date(comment.dateCreated).getTime()
  );
}
