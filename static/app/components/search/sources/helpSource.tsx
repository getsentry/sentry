import {useCallback, useEffect, useState} from 'react';
import type {Result as SearchResult} from '@sentry-internal/global-search';
import {SentryGlobalSearch, standardSDKSlug} from '@sentry-internal/global-search';
import dompurify from 'dompurify';

import parseHtmlMarks from 'sentry/utils/parseHtmlMarks';
import {useDebouncedValue} from 'sentry/utils/useDebouncedValue';

import type {ChildProps, Result, ResultItem} from './types';
import {makeResolvedTs} from './utils';

interface Props {
  /**
   * Render function that renders the global search result
   */
  children: (props: ChildProps) => React.ReactNode;
  /**
   * The string to search the navigation routes for
   */
  query: string;
  /**
   * Specific platforms to filter results to
   */
  platforms?: string[];
}

const MARK_TAGS = {
  highlightPreTag: '<mark>',
  highlightPostTag: '</mark>',
};

function HelpSource({children, query, platforms}: Props) {
  const [results, setResults] = useState<Result[]>([]);
  const [isLoading, setLoading] = useState(true);
  const [search] = useState(
    () => new SentryGlobalSearch(['docs', 'zendesk_sentry_articles', 'develop', 'blog'])
  );

  const debouncedQuery = useDebouncedValue(query);

  const handleSearch = useCallback(async () => {
    setLoading(true);
    const searchResults = await search.query(
      debouncedQuery,
      {
        searchAllIndexes: true,
        platforms: platforms?.map(platform => standardSDKSlug(platform)?.slug!),
      },
      {
        analyticsTags: ['source:dashboard'],
      }
    );
    setResults(mapSearchResults(searchResults));
    setLoading(false);
  }, [platforms, debouncedQuery, search]);

  useEffect(() => void handleSearch(), [handleSearch]);

  return children({isLoading, results});
}

function mapSearchResults(results: SearchResult[]) {
  const resolvedTs = makeResolvedTs();
  const items: Result[] = [];

  results.forEach(section => {
    const sectionItems = section.hits.map(hit => {
      const title = parseHtmlMarks({
        key: 'title',
        htmlString: hit.title ?? '',
        markTags: MARK_TAGS,
      });
      const description = parseHtmlMarks({
        key: 'description',
        htmlString: hit.text ?? '',
        markTags: MARK_TAGS,
      });

      const item: ResultItem = {
        ...hit,
        sourceType: 'help',
        resultType: `help-${hit.site}` as ResultItem['resultType'],
        title: dompurify.sanitize(hit.title ?? ''),
        extra: hit.context.context1,
        description: hit.text ? dompurify.sanitize(hit.text) : undefined,
        to: hit.url,
        resolvedTs,
      };

      return {item, matches: [title, description], score: 1, refIndex: 0};
    });

    // The first element should indicate the section.
    if (sectionItems.length > 0) {
      sectionItems[0]!.item.sectionHeading = section.name;
      sectionItems[0]!.item.sectionCount = sectionItems.length;

      items.push(...sectionItems);
      return;
    }

    // If we didn't have any results for this section mark it as empty
    const emptyHeaderItem: ResultItem = {
      sourceType: 'help',
      resultType: `help-${section.site}` as ResultItem['resultType'],
      title: `No results in ${section.name}`,
      sectionHeading: section.name,
      empty: true,
      resolvedTs,
    };

    items.push({item: emptyHeaderItem, score: 1, refIndex: 0});
  });

  return items;
}

export default HelpSource;
