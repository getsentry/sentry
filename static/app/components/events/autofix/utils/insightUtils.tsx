import type {
  AutofixInsight,
  InsightSources,
} from 'sentry/components/events/autofix/types';

/**
 * Deduplicates sources across multiple insights, combining boolean flags
 * and removing duplicate URLs and IDs.
 */
export function deduplicateSources(insights: AutofixInsight[]): InsightSources {
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

  const seenUrls = new Set<string>();
  const seenIds = new Set<string>();

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

    // Deduplicate URLs
    sources.code_used_urls?.forEach(url => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allSources.code_used_urls.push(url);
      }
    });

    sources.diff_urls?.forEach(url => {
      if (!seenUrls.has(url)) {
        seenUrls.add(url);
        allSources.diff_urls.push(url);
      }
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

  return allSources;
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
