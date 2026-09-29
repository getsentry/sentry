import type {ComponentType, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';

interface QueryEmbedCardProps {
  /** Where the header's "View …" link points. */
  href: string;
  /** Icon rendered before the header link's label. */
  icon: ComponentType<SVGIconProps>;
  /** The header link's label, e.g. "View Query". */
  linkLabel: string;
  testId: string;
  /** The query's name, rendered as the card's heading. */
  title: ReactNode;
  /** Right-aligned label for the query's mode, e.g. "Aggregate" or "Spans". */
  badge?: ReactNode;
  /**
   * Inset content under the query: a chart above a table, or a whole preview
   * for a block with no table. Sits inside the card's padding, unlike `table`.
   */
  children?: ReactNode;
  /**
   * The search string, rendered as formatted tokens in a band flush under the
   * header. Omitted when the query is empty, so an unfiltered preview doesn't
   * show an empty token row.
   */
  query?: string;
  /**
   * A `QueryEmbedTable`, rendered flush against the card's edges below
   * everything else: the card's border already frames it.
   */
  table?: ReactNode;
}

/**
 * The chrome every query-embed block shares: {@link SeerEmbedBlock}'s
 * collapsible card, with the formatted query running edge to edge under the
 * header, any chart inset below it, and the results table edge to edge beneath
 * them.
 */
export function QueryEmbedCard({
  badge,
  children,
  href,
  icon,
  linkLabel,
  query,
  table,
  testId,
  title,
}: QueryEmbedCardProps) {
  return (
    <SeerEmbedBlock
      badge={badge}
      gap="0"
      href={href}
      icon={icon}
      linkLabel={linkLabel}
      padding="0"
      testId={testId}
      title={title}
    >
      {query ? (
        // Runs edge to edge like the table, with the same inset as the log
        // embed's row so its label lines up with the header's title. The label
        // keeps its line while the tokens wrap
        // beside it, so a long query grows downward instead of dropping below.
        // The label's box is one filter token tall (24px) so it centers on the
        // first row of tokens.
        <Flex align="start" gap="sm" padding="lg">
          <Flex align="center" height="24px" flexShrink={0}>
            <Text size="sm" variant="secondary" monospace bold>
              {t('Query:')}
            </Text>
          </Flex>
          <Container flex="1" minWidth="0">
            <ProvidedFormattedQuery query={query} />
          </Container>
        </Flex>
      ) : null}
      {/* A flush table below takes a tighter inset, so a chart sits close to
          the table under it. A card with no table -- an issue list, a saved
          query's summary, a chart on its own -- keeps the roomier inset every
          other block embed uses. The query row's padding already spaces the
          content from it. */}
      <InsetSection
        gap="md"
        padding={table ? 'md' : 'lg'}
        paddingTop={query ? '0' : undefined}
      >
        {children}
      </InsetSection>
      {table}
    </SeerEmbedBlock>
  );
}

/**
 * A chart with nothing to plot renders nothing, so this section can end up
 * with no children. Dropping it then keeps its padding from leaving an empty
 * strip between the query and the table.
 */
const InsetSection = styled(Stack)`
  &:empty {
    display: none;
  }
`;
