interface BuildLinkParams {
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}

export function getBaseBuildPath(params: BuildLinkParams): string | undefined {
  const {organizationSlug, projectId, baseArtifactId} = params;

  if (!baseArtifactId) {
    return undefined;
  }

  return `/organizations/${organizationSlug}/preprod/${projectId}/${baseArtifactId}/`;
}

export function getSizeBuildPath(params: BuildLinkParams): string | undefined {
  return getBaseBuildPath(params);
}

export function getInstallBuildPath(params: BuildLinkParams): string | undefined {
  const basePath = getBaseBuildPath(params);

  if (!basePath) {
    return undefined;
  }

  return `${basePath}install/`;
}

export function getCompareBuildPath(params: {
  headArtifactId: string;
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}): string {
  const {organizationSlug, projectId, headArtifactId, baseArtifactId} = params;

  let path = `/organizations/${organizationSlug}/preprod/${projectId}/compare/${headArtifactId}/`;
  if (baseArtifactId) {
    path += `${baseArtifactId}/`;
  }

  return path;
}

export function getListBuildPath(params: {
  organizationSlug: string;
  projectId: string;
}): string {
  const {organizationSlug, projectId} = params;
  return `/organizations/${organizationSlug}/preprod/${projectId}/`;
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
