import type {ComponentType, ReactNode} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack} from '@sentry/scraps/layout';
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
  /**
   * Inset content under the query: a chart above a table, or a whole preview
   * for a block with no table. Sits inside the card's padding, unlike `table`.
   */
  children?: ReactNode;
  /**
   * The search string, rendered as formatted tokens. Omitted when the query is
   * empty, so an unfiltered preview doesn't show an empty token row.
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
 * collapsible card, with the formatted query and any chart inset at the top and
 * the results table running edge to edge beneath them.
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
      {/* A flush table below takes a tighter inset, so the query row sits close
          to the table it filters. A card with no table -- an issue list, a
          saved query's summary, a chart on its own -- keeps the roomier inset
          every other block embed uses. */}
      <InsetSection gap="md" padding={table ? 'md' : 'lg'}>
        {query ? (
          <Flex
            align="center"
            border="primary"
            gap="sm"
            padding="xs sm"
            radius="md"
            minWidth="0"
          >
            <Text variant="muted">{t('Query:')}</Text>
            <ProvidedFormattedQuery query={query} />
          </Flex>
        ) : null}
        {children}
      </InsetSection>
      {table}
    </SeerEmbedBlock>
  );
}

/**
 * A chart with nothing to plot renders nothing, and an unfiltered query has no
 * token row, so this section can end up with no children. Dropping it then
 * keeps its padding from leaving an empty strip above the table.
 */
const InsetSection = styled(Stack)`
  &:empty {
    display: none;
  }
`;
