import type {DebugIdBundleArtifact} from 'sentry/types';

export function SourceMapsDebugIDBundlesArtifacts(
  debugBundleIdArtifact: Partial<DebugIdBundleArtifact> = {}
): DebugIdBundleArtifact[] {
  return [
    {
      id: 'ZmlsZXMvXy9fL21haW4uanM=',
      fileType: 2,
      filePath: 'files/_/_/main.js',
      fileSize: 239093,
      debugId: '69ac68eb-cc62-44c0-a5dc-b67f219a3696',
      ...debugBundleIdArtifact,
    },
  ];
}
