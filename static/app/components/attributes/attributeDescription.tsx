import type {ReactNode} from 'react';

import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

const COMPONENTS = {Paragraph: AttributeDescriptionParagraph};

export function AttributeDescription({description}: {description: string}) {
  return <Markdown raw={description} components={COMPONENTS} />;
}

function AttributeDescriptionParagraph({children}: {children: ReactNode}) {
  // Unlike overflow-wrap, break-word shrinks the min-content width, so a long
  // unbroken token wraps instead of widening its grid track and the overlay.
  return (
    <Text as="p" wordBreak="break-word">
      {children}
    </Text>
  );
}
