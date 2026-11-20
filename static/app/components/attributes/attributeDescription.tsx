import type {ReactNode} from 'react';

import {Markdown} from '@sentry/scraps/markdown';
import {Text} from '@sentry/scraps/text';

const COMPONENTS = {Paragraph: AttributeDescriptionParagraph};

const COMPONENTS_WITH_TEXT_LINKS = {
  Paragraph: AttributeDescriptionParagraph,
  Link: AttributeDescriptionTextLink,
};

interface AttributeDescriptionProps {
  description: string;
  linksAsText?: boolean;
}

export function AttributeDescription({
  description,
  linksAsText,
}: AttributeDescriptionProps) {
  return (
    <Markdown
      raw={description}
      components={linksAsText ? COMPONENTS_WITH_TEXT_LINKS : COMPONENTS}
    />
  );
}

function AttributeDescriptionParagraph({children}: {children: ReactNode}) {
  return (
    <Text as="p" wordBreak="break-word">
      {children}
    </Text>
  );
}

function AttributeDescriptionTextLink({children}: {children: ReactNode}) {
  return children;
}
