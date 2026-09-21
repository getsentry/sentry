import type {ComponentType, ReactNode} from 'react';

import {ProvidedFormattedQuery} from 'sentry/components/searchQueryBuilder/formattedQuery';
import {SeerEmbedBlock} from 'sentry/components/seer/markdown/embeds/components/seerEmbedBlock';
import type {SVGIconProps} from 'sentry/icons/svgIcon';

interface QueryEmbedCardProps {
  /**
   * The chart and/or table this card frames. A query type with neither — a
   * plain list preview — passes its rows straight through.
   */
  children: ReactNode;
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
   * The search string, rendered as formatted tokens. Omitted when the query is
   * empty, so an unfiltered preview doesn't show an empty token row.
   */
  query?: string;
}

/**
 * The chrome every query-embed block shares: {@link SeerEmbedBlock}'s
 * collapsible card, with the formatted query sitting above whatever preview the
 * embed renders.
 */
export function QueryEmbedCard({
  children,
  href,
  icon,
  linkLabel,
  query,
  testId,
  title,
}: QueryEmbedCardProps) {
  return (
    <SeerEmbedBlock
      href={href}
      icon={icon}
      linkLabel={linkLabel}
      testId={testId}
      title={title}
    >
      {query ? <ProvidedFormattedQuery query={query} /> : null}
      {children}
    </SeerEmbedBlock>
  );
}
