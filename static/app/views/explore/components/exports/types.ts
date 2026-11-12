import type {
  DataExportFormat,
  DiscoverQueryInfo,
  ExploreQueryInfo,
  ExportQueryType,
} from 'sentry/components/exports/useDataExport';

interface ExploreExportConfigBase {
  /** Formats offered in the modal. e.g. `['csv', 'jsonl']` or `['csv']`. */
  availableFormats: DataExportFormat[];
  /** Estimated total rows, used to build the row-count options. */
  estimatedRowCount: number;
  /** Base filename for local (browser) downloads, e.g. `'logs'` or `'Traces'`. */
  filenameBase: string;
  title: string;
  /** Fired on submit so each area can emit its own analytics event. */
  trackExportSubmit: (args: {
    exportType: 'browser_sync' | 'export_download';
    format: DataExportFormat;
    isAllColumns: boolean;
    limit: number;
  }) => void;
  /**
   * Performs the immediate browser download of the first `limit` rows, bounded
   * by `localRowCount`. Omit both when the loaded rows aren't faithful to the
   * stored data — the logs samples table asks the API to truncate long values
   * for display — so every export goes through the server instead.
   */
  localDownload?: (args: {format: DataExportFormat; limit: number}) => void;
  /**
   * Number of rows the local (browser) download can actually serve — typically
   * the loaded page length. A requested limit above this routes to the server
   * export instead, so the user isn't silently given a truncated file.
   */
  localRowCount?: number;
}

/**
 * Everything an Explore area (logs, traces, discover, ...) must supply to drive
 * the shared {@link ExploreExportModal}. The modal and its button stay generic;
 * each area builds this config with a `useXExportConfig()` hook. The union keeps
 * `asyncQueryType` and `queryInfo` in lockstep so the server export payload is
 * type-checked end to end.
 */
export type ExploreExportConfig = DiscoverExportConfig | TraceItemExportConfig;

interface DiscoverExportConfig extends ExploreExportConfigBase {
  asyncQueryType: ExportQueryType.DISCOVER;
  queryInfo: DiscoverQueryInfo;
  supportsAllColumns: false;
}

export interface TraceItemExportConfig extends ExploreExportConfigBase {
  asyncQueryType: ExportQueryType.EXPLORE;
  queryInfo: ExploreQueryInfo;
  supportsAllColumns: boolean;
}

export type ExploreExportModalCloseReason =
  | 'backdrop_click'
  | 'cancel_button'
  | 'close_button'
  | 'escape_key';
