import beautify from 'js-beautify';

import {CodeBlock} from '@sentry/scraps/code';
import {Container} from '@sentry/scraps/layout';

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
    <Container maxWidth="100%" maxHeight="400px" overflow="auto" key={html}>
      <CodeBlock language="html" hideCopyButton>
        {beautify.html(html, {indent_size: 2})}
      </CodeBlock>
    </Container>
  ));
}
