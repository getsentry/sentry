import type {
  SourceMapDebugResponse,
  SourceMapDebugResponseFrame,
} from 'sentry/components/events/interfaces/crashContent/exception/useSourceMapDebuggerData';

type ReleaseProcess = NonNullable<SourceMapDebugResponseFrame['release_process']>;

export function SourceMapDebugReleaseProcessFixture(
  params: Partial<ReleaseProcess> = {}
): ReleaseProcess {
  return {
    abs_path: '~/static/app.min.js',
    matching_source_file_names: [],
    matching_source_map_name: null,
    source_file_lookup_result: 'found',
    source_map_lookup_result: 'found',
    source_map_reference: null,
    ...params,
  };
}

export function SourceMapDebugFrameFixture(
  params: Partial<SourceMapDebugResponseFrame> = {}
): SourceMapDebugResponseFrame {
  return {
    debug_id_process: {
      debug_id: null,
      uploaded_source_file_with_correct_debug_id: false,
      uploaded_source_map_with_correct_debug_id: false,
    },
    release_process: SourceMapDebugReleaseProcessFixture(),
    scraping_process: {source_file: null, source_map: null},
    ...params,
  };
}

export function SourceMapDebugResponseFixture(
  params: Partial<SourceMapDebugResponse> = {}
): SourceMapDebugResponse {
  return {
    dist: null,
    release: null,
    exceptions: [],
    has_debug_ids: false,
    min_debug_id_sdk_version: null,
    sdk_version: null,
    project_has_some_artifact_bundle: false,
    release_has_some_artifact: false,
    has_uploaded_some_artifact_with_a_debug_id: false,
    sdk_debug_id_support: 'not-supported',
    has_scraping_data: false,
    ...params,
  };
}
