import type {SourceMapDebugResponse} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';

export type SourceMapDiagnosis =
  | {
      artifact: 'source-file' | 'source-map';
      dist: string | null;
      path: string;
      release: string | null;
      type: 'dist-mismatch';
    }
  | {path: string; release: string | null; type: 'missing-source'}
  | {path: string; reference: string; release: string | null; type: 'missing-map'}
  | {
      artifact: 'source-file' | 'source-map';
      reason: string;
      type: 'fetch-failure';
      url: string;
    }
  | {release: string | null; type: 'no-artifacts'}
  | {type: 'unknown'};

/** Describe one failing frame in the sample, rather than a project-wide root cause. */
export function getSourceMapDiagnosis(data: SourceMapDebugResponse): SourceMapDiagnosis {
  for (const exception of data.exceptions) {
    for (const frame of exception.frames) {
      const rel = frame.release_process;
      const scraping = frame.scraping_process;
      const debugId = frame.debug_id_process;

      // A successful resolution method makes failures in the fallback methods irrelevant.
      if (
        (data.sdk_debug_id_support === 'full' &&
          debugId.debug_id !== null &&
          debugId.uploaded_source_file_with_correct_debug_id &&
          debugId.uploaded_source_map_with_correct_debug_id) ||
        (data.release !== null &&
          data.release_has_some_artifact &&
          rel?.source_file_lookup_result === 'found' &&
          rel.source_map_lookup_result === 'found') ||
        (scraping?.source_file?.status === 'success' &&
          scraping.source_map?.status === 'success')
      ) {
        continue;
      }

      if (rel?.source_file_lookup_result === 'wrong-dist') {
        return {
          type: 'dist-mismatch',
          artifact: 'source-file',
          path: rel.abs_path,
          release: data.release,
          dist: data.dist,
        };
      }
      if (rel?.source_map_lookup_result === 'wrong-dist' && rel.source_map_reference) {
        return {
          type: 'dist-mismatch',
          artifact: 'source-map',
          path: rel.source_map_reference,
          release: data.release,
          dist: data.dist,
        };
      }
      if (
        rel?.source_file_lookup_result === 'unsuccessful' &&
        rel.source_map_reference === null
      ) {
        return {type: 'missing-source', path: rel.abs_path, release: data.release};
      }
      if (rel?.source_map_lookup_result === 'unsuccessful' && rel.source_map_reference) {
        return {
          type: 'missing-map',
          path: rel.abs_path,
          reference: rel.source_map_reference,
          release: data.release,
        };
      }
      if (scraping?.source_file?.status === 'failure') {
        return {
          type: 'fetch-failure',
          artifact: 'source-file',
          url: scraping.source_file.url,
          reason: scraping.source_file.reason,
        };
      }
      if (scraping?.source_map?.status === 'failure') {
        return {
          type: 'fetch-failure',
          artifact: 'source-map',
          url: scraping.source_map.url,
          reason: scraping.source_map.reason,
        };
      }
    }
  }

  if (!data.project_has_some_artifact_bundle && !data.release_has_some_artifact) {
    return {type: 'no-artifacts', release: data.release};
  }
  return {type: 'unknown'};
}
