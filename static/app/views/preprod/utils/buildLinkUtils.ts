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

  if (viewType === 'install') {
    return `/organizations/${organizationSlug}/preprod/${projectId}/${baseArtifactId}/install/?project=${projectId}`;
  }

  return `/organizations/${organizationSlug}/preprod/${projectId}/${baseArtifactId}/?project=${projectId}`;
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

  if (baseArtifactId) {
    return `/organizations/${organizationSlug}/preprod/${projectId}/compare/${headArtifactId}/${baseArtifactId}/?project=${projectId}`;
  }

  return `/organizations/${organizationSlug}/preprod/${projectId}/compare/${headArtifactId}/?project=${projectId}`;
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
