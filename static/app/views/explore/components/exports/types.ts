import type {
  DataExportFormat,
  ExportQueryType,
} from 'sentry/components/exports/useDataExport';

/**
 * Everything an Explore area (logs, traces, discover, ...) must supply to drive
 * the shared {@link ExploreExportModal}. The modal and its button stay generic;
 * each area builds this config with a `useXExportConfig()` hook.
 */
export interface ExploreExportConfig {
  /**
   * Query type used for the server (email/async) export when NOT exporting all
   * columns. e.g. `EXPLORE` for trace-item datasets, `DISCOVER` for Discover.
   */
  asyncQueryType: ExportQueryType;
  /** Formats offered in the modal. e.g. `['csv', 'jsonl']` or `['csv']`. */
  availableFormats: DataExportFormat[];
  /** Estimated total rows, used to build the row-count options. */
  estimatedRowCount: number;
  /** Base filename for local (browser) downloads, e.g. `'logs'` or `'Traces'`. */
  filenameBase: string;
  /** Performs the immediate browser download of the first `limit` rows. */
  localDownload: (args: {format: DataExportFormat; limit: number}) => void;
  /** Payload sent as `query_info` to the data-export endpoint. */
  queryInfo: Record<string, any>;
  /**
   * Whether the "All Columns" switch (and the trace-item full-export path) is
   * offered. Only trace-item datasets (logs, spans) support this.
   */
  supportsAllColumns: boolean;
  /** Modal header title. */
  title: string;
  /** Fired on submit so each area can emit its own analytics event. */
  trackExportSubmit: (args: {
    exportType: 'browser_sync' | 'export_download';
    format: DataExportFormat;
    isAllColumns: boolean;
    limit: number;
  }) => void;
}

export type ExploreExportModalCloseReason =
  | 'backdrop_click'
  | 'cancel_button'
  | 'close_button'
  | 'escape_key';
