interface BuildLinkParams {
  baseArtifactId: string | null | undefined;
  organizationSlug: string;
  projectId: string;
}

export function getBaseBuildUrl(params: BuildLinkParams): string | null {
  const {organizationSlug, projectId, baseArtifactId} = params;

  if (!baseArtifactId) {
    return null;
  }

  return `/organizations/${organizationSlug}/preprod/${projectId}/${baseArtifactId}/`;
}

export function getSizeBuildUrl(params: BuildLinkParams): string | null {
  return getBaseBuildUrl(params);
}

export function getInstallBuildUrl(params: BuildLinkParams): string | null {
  const baseUrl = getBaseBuildUrl(params);

  if (!baseUrl) {
    return null;
  }

  return `${baseUrl}install/`;
}

export function getCompareBuildUrl(params: {
  headArtifactId: string;
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}): string {
  const {organizationSlug, projectId, headArtifactId, baseArtifactId} = params;

  let path = `/organizations/${organizationSlug}/preprod/${projectId}/compare/${headArtifactId}`;
  if (baseArtifactId) {
    path += `/${baseArtifactId}`;
  }
  path += '/';

  return path;
}

export function getListBuildUrl(params: {
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
