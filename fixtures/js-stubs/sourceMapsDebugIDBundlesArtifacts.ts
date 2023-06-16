import type {DebugIdBundleArtifact} from 'sentry/types';

export function SourceMapsDebugIDBundlesArtifacts(
  debugBundleIdArtifact: Partial<DebugIdBundleArtifact> = {}
): DebugIdBundleArtifact {
  return {
    bundleId: '7227e105-744e-4066-8c69-3e5e344723fc',
    release: null,
    dist: null,
    associations: [
      {
        release: 'v2.0',
        dist: null,
      },
      {
        release: 'frontend@2e318148eac9298ec04a662ae32b4b093b027f0a',
        dist: ['android', 'iOS'],
      },
    ],
    files: [
      {
        id: 'ZmlsZXMvXy9fL21haW4uanM=',
        fileType: 2,
        filePath: 'files/_/_/main.js',
        fileSize: 239093,
        debugId: '69ac68eb-cc62-44c0-a5dc-b67f219a3696',
      },
    ],
    ...debugBundleIdArtifact,
  };
}
