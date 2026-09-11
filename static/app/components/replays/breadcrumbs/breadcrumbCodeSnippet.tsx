import {CodeBlock} from '@sentry/scraps/code';
import {Container} from '@sentry/scraps/layout';

import {Placeholder} from 'sentry/components/placeholder';
import type {Extraction} from 'sentry/utils/replays/extractDomNodes';
import type {ReplayFrame} from 'sentry/utils/replays/types';
import {isSpanFrame} from 'sentry/utils/replays/types';
import {useFormattedCode} from 'sentry/utils/useFormattedCode';

interface Props {
  frame: ReplayFrame;
  isPending: boolean;
  showSnippet: boolean;
  extraction?: Extraction;
}

const HTML_FORMAT_OPTIONS = {indent_size: 2} as const;

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

  return extraction?.html?.map(html => <FormattedHtmlSnippet html={html} key={html} />);
}

function FormattedHtmlSnippet({html}: {html: string}) {
  const {formattedCode} = useFormattedCode({
    code: html,
    language: 'html',
    options: HTML_FORMAT_OPTIONS,
  });

  return (
    <Container maxWidth="100%" maxHeight="400px" overflow="auto">
      <CodeBlock language="html" hideCopyButton>
        {formattedCode}
      </CodeBlock>
    </Container>
  );
}
