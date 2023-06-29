export type DebugIdBundleAssociation = {
  dist: string[] | string | null;
  release: string;
};

export type DebugIdBundle = {
  associations: DebugIdBundleAssociation[];
  bundleId: string;
  date: string;
  dateModified: string;
  // TODO(Pri): Remove this type once fully transitioned to associations.
  dist: string | null;
  fileCount: number;
  // TODO(Pri): Remove this type once fully transitioned to associations.
  release: string | null;
};

export type DebugIdBundleArtifact = {
  associations: DebugIdBundleAssociation[];
  bundleId: string;
  // TODO(Pri): Remove this type once fully transitioned to associations.
  dist: string | null;
  files: {
    debugId: string;
    filePath: string;
    fileSize: number;
    fileType: number;
    id: string;
  }[];
  // TODO(Pri): Remove this type once fully transitioned to associations.
  release: string | null;
};
