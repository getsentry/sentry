import type {ComponentType, ReactNode} from 'react';
import styled from '@emotion/styled';
import type {SVGIconProps} from '@sentry/icons/svgIcon';

import {Container, Flex, Stack} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
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
      gap="0"
      href={href}
      icon={icon}
      linkLabel={linkLabel}
      padding="0"
      testId={testId}
      title={title}
    >
      {query ? (
        // A white row edge to edge under the header, like the table below it.
        // The tokens sit together in one inset box that fills the row and
        // wraps a long query onto more lines inside it.
        <Flex align="center" gap="md" padding="lg" borderTop="primary">
          <Text variant="muted" wrap="nowrap">
            {t('Query:')}
          </Text>
          <Container
            flex="1"
            minWidth="0"
            background="secondary"
            border="primary"
            radius="md"
            padding="xs"
          >
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
