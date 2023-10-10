import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';
import marked from 'sentry/utils/marked';

type Props = {
  text: string;
};

function NoteBody({text}: Props) {
  return (
    <StyledNoteBody
      data-test-id="activity-note-body"
      dangerouslySetInnerHTML={{__html: marked(text)}}
    />
  );
}

const StyledNoteBody = styled('div')`
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
    margin-bottom: ${space(2)};
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
    border-left: 5px solid ${p => p.theme.innerBorder};
    padding-left: ${space(1)};
    margin-left: 0;
  }
`;

export {NoteBody};
