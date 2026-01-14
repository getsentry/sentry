interface BuildLinkParams {
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}

export function getBaseBuildPath(
  params: BuildLinkParams,
  viewType?: 'size' | 'install'
): string | undefined {
  const {organizationSlug, projectId, baseArtifactId} = params;

  if (!baseArtifactId) {
    return undefined;
  }

  if (viewType) {
    return `/organizations/${organizationSlug}/preprod/${viewType}/${baseArtifactId}/?project=${projectId}`;
  }

  // Default to size view if no viewType specified
  return `/organizations/${organizationSlug}/preprod/size/${baseArtifactId}/?project=${projectId}`;
}

export function getSizeBuildPath(params: BuildLinkParams): string | undefined {
  return getBaseBuildPath(params, 'size');
}

export function getInstallBuildPath(params: BuildLinkParams): string | undefined {
  return getBaseBuildPath(params, 'install');
}

export function getCompareBuildPath(params: {
  headArtifactId: string;
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}): string {
  const {organizationSlug, projectId, headArtifactId, baseArtifactId} = params;

  let path = `/organizations/${organizationSlug}/preprod/size/compare/${headArtifactId}/`;
  if (baseArtifactId) {
    path = `/organizations/${organizationSlug}/preprod/size/compare/${headArtifactId}/${baseArtifactId}/`;
  }

  return `${path}?project=${projectId}`;
}

export function getSnapshotsCompareBuildPath(params: {
  baseArtifactId: string;
  headArtifactId: string;
  organizationSlug: string;
  projectId: string;
}): string {
  const {organizationSlug, projectId, headArtifactId, baseArtifactId} = params;
  return `/organizations/${organizationSlug}/preprod/snapshots/compare/${headArtifactId}/${baseArtifactId}/?project=${projectId}`;
}

export function getListBuildPath(params: {
  organizationSlug: string;
  projectId: string;
}): string {
  const {organizationSlug, projectId} = params;
  return `/organizations/${organizationSlug}/preprod/?project=${projectId}`;
}

export function formatBuildName(
  version: string | number | null | undefined,
  buildNumber: string | number | null | undefined
): string | null {
  if (
    version === undefined ||
    version === null ||
    buildNumber === undefined ||
    buildNumber === null
  ) {
    return null;
  }

  return `v${version} (${buildNumber})`;
}
