import {Fragment, useCallback, useState} from 'react';
import {SentryGlobalSearch} from '@sentry-internal/global-search';

import {makeCommandPaletteCallback} from 'sentry/components/commandPalette/makeCommandPaletteAction';
import type {CommandPaletteAction} from 'sentry/components/commandPalette/types';
import {useDynamicCommandPaletteAction} from 'sentry/components/commandPalette/useDynamicCommandPaletteAction';
import {IconDocs} from 'sentry/icons';

const MIN_QUERY_LENGTH = 3;
const MAX_RESULTS = 5;

const MARK_OPEN = '<mark>';
const MARK_CLOSE = '</mark>';
const MARK_PATTERN = new RegExp(`(${MARK_OPEN}.*?${MARK_CLOSE})`, 'g');

function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '');
}

/**
 * Converts `<mark>` highlight tags from Algolia into bold text.
 * Falls back to plain text when there are no marks.
 */
function highlightMarks(html: string): React.ReactNode {
  const parts = html.split(MARK_PATTERN);

  if (parts.length === 1) {
    return stripHtml(html);
  }

  return (
    <Fragment>
      {parts.map((part, i) => {
        if (part.startsWith(MARK_OPEN) && part.endsWith(MARK_CLOSE)) {
          const text = part.slice(MARK_OPEN.length, -MARK_CLOSE.length);
          return (
            <strong key={i} style={{fontWeight: 700}}>
              {text}
            </strong>
          );
        }
        return stripHtml(part);
      })}
    </Fragment>
  );
}

export function useDocsSearchActions(): void {
  const [search] = useState(() => new SentryGlobalSearch(['docs', 'develop']));

  const queryAction = useCallback(
    async (query: string): Promise<CommandPaletteAction[]> => {
      if (query.length < MIN_QUERY_LENGTH) {
        return [];
      }

      const results = await search.query(
        query,
        {searchAllIndexes: true},
        {analyticsTags: ['source:command-palette']}
      );

      return results
        .flatMap(section => section.hits)
        .slice(0, MAX_RESULTS)
        .map(hit =>
          makeCommandPaletteCallback({
            display: {
              label: stripHtml(hit.title ?? ''),
              labelNode: highlightMarks(hit.title ?? ''),
              details: hit.context?.context1,
              icon: <IconDocs />,
            },
            groupingKey: 'help',
            keywords: [hit.context?.context1, hit.context?.context2].filter(
              Boolean
            ) as string[],
            onAction: () => window.open(hit.url, '_blank', 'noreferrer'),
          })
        );
    },
    [search]
  );

  useDynamicCommandPaletteAction(queryAction);
}
