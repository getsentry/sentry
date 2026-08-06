import styled from '@emotion/styled';

import {Disclosure} from '@sentry/scraps/disclosure';
import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

function IssuePreviewSectionComponent({
  children,
  defaultExpanded,
}: {
  children: NonNullable<React.ReactNode>;
  defaultExpanded?: boolean;
}) {
  return (
    <Container>
      <Disclosure as="section" size="md" defaultExpanded={defaultExpanded}>
        {children}
      </Disclosure>
    </Container>
  );
}

function Title({
  children,
  trailingItems,
}: {
  children: React.ReactNode;
  trailingItems?: React.ReactNode;
}) {
  return (
    <Disclosure.Title trailingItems={trailingItems}>
      <Heading as="h3" size="md">
        {children}
      </Heading>
    </Disclosure.Title>
  );
}

function Summary({children}: {children: React.ReactNode}) {
  return <SummaryContainer>{children}</SummaryContainer>;
}

/**
 * Thin abstraction over the Disclosure component which is meant to be used for the issue preview sections.
 * Issue preview sections have summary lines which need to be indented to visually match the content lines.
 */
export const IssuePreviewSection = Object.assign(IssuePreviewSectionComponent, {
  Content: Disclosure.Content,
  Summary,
  Title,
});

// Always displayed, even if the disclosure is closed. The left padding matches
// the indent of Disclosure.Content.
const SummaryContainer = styled(Container)`
  padding: 0 ${p => p.theme.space.md} ${p => p.theme.space.md} 26px;
`;
