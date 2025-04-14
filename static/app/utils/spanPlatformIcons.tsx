/**
 * Utility function to map span origins to platform icons
 * This allows us to display custom icons for specific span origins without needing to update the platformicons package
 */

// Import types from TraceTree
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

/**
 * Map of span origins to platform icons
 * When a span's origin matches one of these keys, we'll use the corresponding platform icon instead of the project's platform
 */
export const SPAN_ORIGIN_TO_PLATFORM_MAP: Record<string, string> = {
  'auto.db.supabase': 'supabase',
};

/**
 * Get the appropriate platform icon for a span based on its origin
 *
 * @param span The span object
 * @param defaultPlatform The default platform to use if no custom mapping exists
 * @returns The platform string to use with the PlatformIcon component
 */
export function getSpanPlatformIcon(
  span: {origin?: string} | TraceTree.Span | TraceTree.EAPSpan | undefined | null,
  defaultPlatform: string
): string {
  if (!span) {
    return defaultPlatform;
  }

  // Handle the span origin property regardless of the object type
  const origin = 'origin' in span ? span.origin : undefined;

  if (!origin) {
    return defaultPlatform;
  }

  return SPAN_ORIGIN_TO_PLATFORM_MAP[origin] || defaultPlatform;
}
