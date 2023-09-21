import {FrameSourceMapDebuggerData} from 'sentry/components/events/interfaces/sourceMapsDebuggerModal';
import {Event} from 'sentry/types/event';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

interface SourceMapDebugBlueThunderResponseFrame {
  debug_id_process: {
    debug_id: string | null;
    uploaded_source_file_with_correct_debug_id: boolean;
    uploaded_source_map_with_correct_debug_id: boolean;
  };
  release_process: {
    abs_path: string;
    matching_source_file_names: string[];
    matching_source_map_name: string | null;
    source_file_lookup_result: 'found' | 'wrong-dist' | 'unsuccessful';
    source_map_lookup_result: 'found' | 'wrong-dist' | 'unsuccessful';
    source_map_reference: string | null;
  } | null;
}

interface SourceMapDebugBlueThunderResponse {
  dist: string | null;
  exceptions: {
    frames: SourceMapDebugBlueThunderResponseFrame[];
  }[];
  has_debug_ids: boolean;
  has_uploaded_some_artifact_with_a_debug_id: boolean;
  project_has_some_artifact_bundle: boolean;
  release: string | null;
  release_has_some_artifact: boolean;
  sdk_debug_id_support: 'not-supported' | 'unofficial-sdk' | 'needs-upgrade' | 'full';
  sdk_version: string | null;
}

export function useSourceMapDebuggerData(event: Event, projectSlug: string) {
  const isSdkThatShouldShowSourceMapsDebugger =
    !!event.sdk?.name.startsWith('sentry.javascript.');
  const organization = useOrganization({allowNull: true});
  const {data: sourceMapDebuggerData} = useApiQuery<SourceMapDebugBlueThunderResponse>(
    [
      `/projects/${organization!.slug}/${projectSlug}/events/${
        event.id
      }/source-map-debug-blue-thunder-edition/`,
    ],
    {
      enabled:
        isSdkThatShouldShowSourceMapsDebugger &&
        organization !== null &&
        organization.features.includes('source-maps-debugger-blue-thunder-edition'),
      staleTime: Infinity,
      retry: false,
      refetchOnWindowFocus: false,
    }
  );
  return sourceMapDebuggerData;
}

export function mapSourceMapDebuggerFrameInformation(
  sourceMapDebuggerData: SourceMapDebugBlueThunderResponse,
  debuggerFrame: SourceMapDebugBlueThunderResponseFrame
): FrameSourceMapDebuggerData {
  return {
    dist: sourceMapDebuggerData.dist,
    eventHasDebugIds: sourceMapDebuggerData.has_debug_ids,
    matchingSourceFileNames:
      debuggerFrame.release_process?.matching_source_file_names ?? [],
    release: sourceMapDebuggerData.release,
    releaseHasSomeArtifact: sourceMapDebuggerData.release_has_some_artifact,
    releaseSourceMapReference:
      debuggerFrame.release_process?.source_map_reference ?? null,
    sdkDebugIdSupport: sourceMapDebuggerData.sdk_debug_id_support,
    sourceFileReleaseNameFetchingResult:
      debuggerFrame.release_process?.source_file_lookup_result ?? 'unsuccessful',
    sourceFileScrapingStatus: {status: 'none'},
    sourceMapReleaseNameFetchingResult:
      debuggerFrame.release_process?.source_map_lookup_result ?? 'unsuccessful',
    sourceMapScrapingStatus: {status: 'none'},
    stackFrameDebugId: debuggerFrame.debug_id_process.debug_id,
    stackFramePath: debuggerFrame.release_process?.abs_path ?? null,
    uploadedSomeArtifactWithDebugId:
      sourceMapDebuggerData.has_uploaded_some_artifact_with_a_debug_id,
    uploadedSourceFileWithCorrectDebugId:
      debuggerFrame.debug_id_process.uploaded_source_file_with_correct_debug_id,
    uploadedSourceMapWithCorrectDebugId:
      debuggerFrame.debug_id_process.uploaded_source_map_with_correct_debug_id,
    sdkVersion: sourceMapDebuggerData.sdk_version,
    matchingSourceMapName:
      debuggerFrame.release_process?.matching_source_map_name ?? null,
  } satisfies FrameSourceMapDebuggerData;
}
