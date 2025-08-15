import styled from '@emotion/styled';
import beautify from 'js-beautify';

import {CodeSnippet} from 'sentry/components/codeSnippet';
import Placeholder from 'sentry/components/placeholder';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';

interface Props {
  frame: ReplayFrame;
  isPending: boolean;
  showSnippet: boolean;
  extraction?: Extraction;
}

export function BreadcrumbCodeSnippet({
  frame,
  extraction,
  showSnippet,
  isPending,
}: Props) {
  if (!showSnippet) {
    return null;
  }

  if (isPending) {
    return <Placeholder height="34px" />;
  }

  if (isSpanFrame(frame)) {
    return null;
  }

  return extraction?.html?.map(html => (
    <CodeContainer key={html}>
      <CodeSnippet language="html" hideCopyButton>
        {beautify.html(html, {indent_size: 2})}
      </CodeSnippet>
    </CodeContainer>
  ));
}

const CodeContainer = styled('div')`
  max-height: 400px;
  max-width: 100%;
  overflow: auto;
`;
