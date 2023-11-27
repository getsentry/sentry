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
  scraping_process?: {
    source_file:
      | {status: 'success'; url: string}
      | {reason: string; status: 'failure'; url: string; details?: string}
      | {status: 'not_attempted'; url: string}
      | null;
    source_map:
      | {status: 'success'; url: string}
      | {reason: string; status: 'failure'; url: string; details?: string}
      | {status: 'not_attempted'; url: string}
      | null;
  };
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
  has_scraping_data?: boolean;
  min_debug_id_sdk_version?: string | null;
}

export function useSourceMapDebuggerData(event: Event, projectSlug: string) {
  const isSdkThatShouldShowSourceMapsDebugger =
    !!event.sdk?.name?.startsWith('sentry.javascript.');
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

function getDebugIdProgress(
  sourceMapDebuggerData: SourceMapDebugBlueThunderResponse,
  debuggerFrame: SourceMapDebugBlueThunderResponseFrame
) {
  let debugIdProgress = 0;
  if (sourceMapDebuggerData.sdk_debug_id_support === 'full') {
    debugIdProgress++;
  }
  if (debuggerFrame.debug_id_process.debug_id !== null) {
    debugIdProgress++;
  }
  if (debuggerFrame.debug_id_process.uploaded_source_file_with_correct_debug_id) {
    debugIdProgress++;
  }
  if (debuggerFrame.debug_id_process.uploaded_source_map_with_correct_debug_id) {
    debugIdProgress++;
  }
  return {debugIdProgress, debugIdProgressPercent: debugIdProgress / 4};
}

function getReleaseProgress(
  sourceMapDebuggerData: SourceMapDebugBlueThunderResponse,
  debuggerFrame: SourceMapDebugBlueThunderResponseFrame
) {
  let releaseProgress = 0;
  if (sourceMapDebuggerData.release !== null) {
    releaseProgress++;
  }
  if (sourceMapDebuggerData.release_has_some_artifact) {
    releaseProgress++;
  }
  if (debuggerFrame.release_process?.source_file_lookup_result === 'found') {
    releaseProgress++;
  }
  if (debuggerFrame.release_process?.source_map_lookup_result === 'found') {
    releaseProgress++;
  }
  return {releaseProgress, releaseProgressPercent: releaseProgress / 4};
}

function getScrapingProgress(debuggerFrame: SourceMapDebugBlueThunderResponseFrame) {
  let scrapingProgress = 0;

  if (debuggerFrame.scraping_process?.source_file?.status === 'success') {
    scrapingProgress++;
  }

  if (debuggerFrame.scraping_process?.source_map?.status === 'success') {
    // We give this step a relative weight of 4/5ths because this is actually way
    // harder than step 1 and we want do deprioritize this tab over the others
    // because the scraping process comes with a few downsides that aren't immediately
    // obvious.
    scrapingProgress += 4;
  }

  return {scrapingProgress, scrapingProgressPercent: scrapingProgress / 5};
}

export function prepareSourceMapDebuggerFrameInformation(
  sourceMapDebuggerData: SourceMapDebugBlueThunderResponse,
  debuggerFrame: SourceMapDebugBlueThunderResponseFrame,
  event: Event
): FrameSourceMapDebuggerData {
  const {debugIdProgressPercent, debugIdProgress} = getDebugIdProgress(
    sourceMapDebuggerData,
    debuggerFrame
  );
  const {releaseProgressPercent, releaseProgress} = getReleaseProgress(
    sourceMapDebuggerData,
    debuggerFrame
  );
  const {scrapingProgressPercent, scrapingProgress} = getScrapingProgress(debuggerFrame);

  const frameIsResolved =
    debugIdProgressPercent === 1 ||
    releaseProgressPercent === 1 ||
    scrapingProgressPercent === 1;

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
    sourceFileScrapingStatus: debuggerFrame.scraping_process?.source_file ?? null,
    sourceMapReleaseNameFetchingResult:
      debuggerFrame.release_process?.source_map_lookup_result ?? 'unsuccessful',
    sourceMapScrapingStatus: debuggerFrame.scraping_process?.source_map ?? null,
    stackFrameDebugId: debuggerFrame.debug_id_process.debug_id,
    stackFramePath: debuggerFrame.release_process?.abs_path ?? null,
    uploadedSomeArtifactWithDebugId:
      sourceMapDebuggerData.has_uploaded_some_artifact_with_a_debug_id,
    uploadedSourceFileWithCorrectDebugId:
      debuggerFrame.debug_id_process.uploaded_source_file_with_correct_debug_id,
    uploadedSourceMapWithCorrectDebugId:
      debuggerFrame.debug_id_process.uploaded_source_map_with_correct_debug_id,
    sdkVersion: sourceMapDebuggerData.sdk_version,
    sdkName: event.sdk?.name ?? null,
    matchingSourceMapName:
      debuggerFrame.release_process?.matching_source_map_name ?? null,
    debugIdProgressPercent,
    debugIdProgress,
    releaseProgressPercent,
    releaseProgress,
    scrapingProgressPercent,
    scrapingProgress,
    frameIsResolved,
    hasScrapingData: sourceMapDebuggerData.has_scraping_data ?? false,
    minDebugIdSdkVersion: sourceMapDebuggerData.min_debug_id_sdk_version ?? null,
  } satisfies FrameSourceMapDebuggerData;
}
