import type {
  AutofixInsight,
  InsightSources,
} from 'sentry/components/events/autofix/types';

type ParsedCodeUrl = {
  baseUrl: string;
  endLine: number | null;
  startLine: number | null;
};

/**
 * Parses a code URL to extract the base URL and line range information.
 * Supports GitHub-style URLs with #L10 or #L10-L20 format.
 */
function parseCodeUrl(url: string): ParsedCodeUrl {
  try {
    const urlObj = new URL(url);
    const hash = urlObj.hash;

    // Remove hash from base URL
    const baseUrl = url.replace(hash || '', '');

    if (hash) {
      // Check for GitHub-style line numbers in hash (#L10 or #L10-L20)
      const lineMatch = hash.match(/^#L(\d+)(?:-L(\d+))?$/);
      if (lineMatch) {
        const startLine = parseInt(lineMatch[1]!, 10);
        const endLine = lineMatch[2] ? parseInt(lineMatch[2], 10) : startLine;
        return {baseUrl, endLine, startLine};
      }
    }

    // Check query parameters for line numbers (L, line, etc.)
    const searchParams = new URLSearchParams(urlObj.search);
    if (searchParams.has('L') || searchParams.has('line')) {
      const lineParam = searchParams.get('L') || searchParams.get('line');
      if (lineParam !== null) {
        const lineNum = parseInt(lineParam, 10);
        if (!isNaN(lineNum)) {
          return {baseUrl: baseUrl.split('?')[0]!, endLine: lineNum, startLine: lineNum};
        }
      }
    }

    return {baseUrl, endLine: null, startLine: null};
  } catch (e) {
    return {baseUrl: url, endLine: null, startLine: null};
  }
}

/**
 * Checks if range1 contains range2 (i.e., range1 is wider or equal).
 */
function rangeContains(
  range1: {endLine: number; startLine: number},
  range2: {endLine: number; startLine: number}
): boolean {
  return range1.startLine <= range2.startLine && range1.endLine >= range2.endLine;
}

/**
 * Creates a merged URL with the wider line range.
 */
function createMergedUrl(baseUrl: string, startLine: number, endLine: number): string {
  if (startLine === endLine) {
    return `${baseUrl}#L${startLine}`;
  }
  return `${baseUrl}#L${startLine}-L${endLine}`;
}

/**
 * Merges code URLs with overlapping or containing line ranges.
 * Returns a map of original URLs to their merged URLs.
 */
function mergeCodeUrls(urls: string[]): Map<string, string> {
  const urlMapping = new Map<string, string>();
  const parsedUrls = urls.map(url => ({parsed: parseCodeUrl(url), url}));

  // Group URLs by base URL
  const baseUrlGroups = new Map<string, Array<{parsed: ParsedCodeUrl; url: string}>>();
  parsedUrls.forEach(({parsed, url}) => {
    if (!baseUrlGroups.has(parsed.baseUrl)) {
      baseUrlGroups.set(parsed.baseUrl, []);
    }
    baseUrlGroups.get(parsed.baseUrl)!.push({parsed, url});
  });

  // Process each group to find containing ranges
  baseUrlGroups.forEach(group => {
    // Separate URLs with and without line ranges
    const withRanges = group.filter(
      item => item.parsed.startLine !== null && item.parsed.endLine !== null
    );
    const withoutRanges = group.filter(
      item => item.parsed.startLine === null || item.parsed.endLine === null
    );

    // For URLs without ranges, map them to themselves
    withoutRanges.forEach(item => {
      urlMapping.set(item.url, item.url);
    });

    if (withRanges.length === 0) return;

    // Sort by range size (largest first) to prioritize wider ranges
    withRanges.sort((a, b) => {
      const sizeA = a.parsed.endLine! - a.parsed.startLine!;
      const sizeB = b.parsed.endLine! - b.parsed.startLine!;
      return sizeB - sizeA;
    });

    const processed = new Set<string>();

    withRanges.forEach(item => {
      if (processed.has(item.url)) return;

      const currentRange = {
        startLine: item.parsed.startLine!,
        endLine: item.parsed.endLine!,
      };

      // Find all URLs that this range contains
      const contained = withRanges.filter(
        other =>
          !processed.has(other.url) &&
          other.url !== item.url &&
          rangeContains(currentRange, {
            startLine: other.parsed.startLine!,
            endLine: other.parsed.endLine!,
          })
      );

      // Map the main URL and all contained URLs to the wider range
      const mergedUrl = createMergedUrl(
        item.parsed.baseUrl,
        currentRange.startLine,
        currentRange.endLine
      );

      urlMapping.set(item.url, mergedUrl);
      processed.add(item.url);

      contained.forEach(containedItem => {
        urlMapping.set(containedItem.url, mergedUrl);
        processed.add(containedItem.url);
      });
    });
  });

  return urlMapping;
}

/**
 * Deduplicates sources across multiple insights, combining boolean flags
 * and removing duplicate URLs and IDs. Also merges code URLs with overlapping ranges.
 */
function deduplicateSources(insights: AutofixInsight[]): InsightSources {
  const allSources: InsightSources = {
    breadcrumbs_used: false,
    code_used_urls: [],
    connected_error_ids_used: [],
    diff_urls: [],
    http_request_used: false,
    profile_ids_used: [],
    stacktrace_used: false,
    thoughts: '',
    trace_event_ids_used: [],
    event_trace_id: undefined,
    event_trace_timestamp: undefined,
  };

  const seenIds = new Set<string>();
  const allCodeUrls: string[] = [];
  const allDiffUrls: string[] = [];

  insights.forEach(insight => {
    if (!insight?.sources) return;

    const sources = insight.sources;

    // Boolean flags - OR them together
    allSources.breadcrumbs_used = allSources.breadcrumbs_used || sources.breadcrumbs_used;
    allSources.http_request_used =
      allSources.http_request_used || sources.http_request_used;
    allSources.stacktrace_used = allSources.stacktrace_used || sources.stacktrace_used;

    // Use the first available event_trace_id
    if (!allSources.event_trace_id && sources.event_trace_id) {
      allSources.event_trace_id = sources.event_trace_id;
    }

    // Use the first available event_trace_timestamp
    if (!allSources.event_trace_timestamp && sources.event_trace_timestamp) {
      allSources.event_trace_timestamp = sources.event_trace_timestamp;
    }

    // Collect all URLs for merging
    sources.code_used_urls?.forEach(url => {
      allCodeUrls.push(url);
    });

    sources.diff_urls?.forEach(url => {
      allDiffUrls.push(url);
    });

    // Deduplicate IDs
    sources.trace_event_ids_used?.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allSources.trace_event_ids_used.push(id);
      }
    });

    sources.profile_ids_used?.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allSources.profile_ids_used.push(id);
      }
    });

    sources.connected_error_ids_used?.forEach(id => {
      if (!seenIds.has(id)) {
        seenIds.add(id);
        allSources.connected_error_ids_used.push(id);
      }
    });
  });

  // Merge code URLs with overlapping ranges and deduplicate
  const codeUrlMapping = mergeCodeUrls(allCodeUrls);
  const mergedCodeUrls = new Set<string>();
  codeUrlMapping.forEach(mergedUrl => {
    mergedCodeUrls.add(mergedUrl);
  });
  allSources.code_used_urls = Array.from(mergedCodeUrls);

  // Merge diff URLs with overlapping ranges and deduplicate
  const diffUrlMapping = mergeCodeUrls(allDiffUrls);
  const mergedDiffUrls = new Set<string>();
  diffUrlMapping.forEach(mergedUrl => {
    mergedDiffUrls.add(mergedUrl);
  });
  allSources.diff_urls = Array.from(mergedDiffUrls);

  return allSources;
}

/**
 * Updates insights to use merged URLs from deduplication.
 * Returns a new array of insights with updated sources.
 */
function updateInsightsWithMergedUrls(insights: AutofixInsight[]): AutofixInsight[] {
  // Collect all URLs first
  const allCodeUrls: string[] = [];
  const allDiffUrls: string[] = [];

  insights.forEach(insight => {
    if (!insight?.sources) return;
    const sources = insight.sources;

    sources.code_used_urls?.forEach(url => allCodeUrls.push(url));
    sources.diff_urls?.forEach(url => allDiffUrls.push(url));
  });

  // Create mappings for merged URLs
  const codeUrlMapping = mergeCodeUrls(allCodeUrls);
  const diffUrlMapping = mergeCodeUrls(allDiffUrls);

  // Update each insight with merged URLs
  return insights.map(insight => {
    if (!insight?.sources) return insight;

    const updatedSources: InsightSources = {
      ...insight.sources,
      code_used_urls:
        insight.sources.code_used_urls?.map(url => codeUrlMapping.get(url) || url) || [],
      diff_urls:
        insight.sources.diff_urls?.map(url => diffUrlMapping.get(url) || url) || [],
    };

    return {
      ...insight,
      sources: updatedSources,
    };
  });
}

/**
 * Deduplicates sources and updates insights with merged URLs.
 * Returns both the deduplicated sources and updated insights.
 */
export function deduplicateSourcesAndUpdateInsights(insights: AutofixInsight[]): {
  deduplicatedSources: InsightSources;
  updatedInsights: AutofixInsight[];
} {
  const updatedInsights = updateInsightsWithMergedUrls(insights);
  const deduplicatedSources = deduplicateSources(updatedInsights);

  return {deduplicatedSources, updatedInsights};
}

/**
 * Gets the sources for the currently expanded insight card.
 */
export function getExpandedInsightSources(
  insights: AutofixInsight[],
  expandedCardIndex: number | null
): InsightSources | undefined {
  if (expandedCardIndex === null || expandedCardIndex >= insights.length) {
    return undefined;
  }
  return insights[expandedCardIndex]?.sources;
}
