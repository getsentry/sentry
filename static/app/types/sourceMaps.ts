export type DebugIdBundle = {
  bundleId: string;
  date: string;
  dist: string | null;
  fileCount: number;
  release: string | null;
};

export type DebugIdBundleArtifact = {
  bundleId: string;
  dist: string | null;
  files: {
    debugId: string;
    filePath: string;
    fileSize: number;
    fileType: number;
    id: string;
  }[];
  release: string | null;
};
