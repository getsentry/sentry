import styled from '@emotion/styled';

import {MarkedText} from 'sentry/utils/marked/markedText';

type Props = {
  text: string;
};

function NoteBody({text}: Props) {
  return <StyledNoteBody data-test-id="activity-note-body" text={text} />;
}

const StyledNoteBody = styled(MarkedText)`
  ul {
    list-style: disc;
  }

  h1,
  h2,
  h3,
  h4,
  p,
  ul:not(.nav),
  ol,
  pre,
  hr,
  blockquote {
    margin-bottom: ${p => p.theme.space.xl};
  }

  ul,
  ol {
    padding-left: 20px;
  }

  p {
    a {
      word-wrap: break-word;
    }
  }

  blockquote {
    font-size: 15px;
    border-left: 5px solid ${p => p.theme.tokens.border.secondary};
    padding-left: ${p => p.theme.space.md};
    margin-left: 0;
  }
`;

export {NoteBody};
