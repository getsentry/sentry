import type {ReactNode} from 'react';

import {Container, Flex, Stack} from '@sentry/scraps/layout';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';

interface QueryEmbedCardProps {
  /**
   * The chart and/or table this card frames. A query type with neither — a
   * plain list preview — passes its rows straight through.
   */
  children: ReactNode;
  /** The embed's own inline link component, rendered as the card's heading. */
  link: ReactNode;
  testId: string;
  /** Right-aligned label for the query's mode, e.g. "Aggregate" or "Spans". */
  badge?: ReactNode;
  /**
   * The search string, rendered as formatted tokens. Omitted when the query is
   * empty, so an unfiltered preview doesn't show an empty token row.
   */
  query?: string;
}

/**
 * The chrome every query-embed block shares: a bordered card holding the
 * resource link, the formatted query, and whatever preview the embed renders.
 */
export function QueryEmbedCard({
  badge,
  children,
  link,
  query,
  testId,
}: QueryEmbedCardProps) {
  return (
    <Container
      as="section"
      background="primary"
      border="primary"
      data-test-id={testId}
      margin="lg 0"
      padding="lg"
      radius="md"
      width="100%"
    >
      <Stack gap="md">
        <Flex align="center" gap="md" justify="between">
          {link}
          {badge}
        </Flex>
        {query ? <ProvidedFormattedQuery query={query} /> : null}
        {children}
      </Stack>
    </Container>
  );
}
