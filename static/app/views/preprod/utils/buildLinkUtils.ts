interface BuildLinkParams {
  baseArtifactId: string | null | undefined;
  organizationSlug: string;
  projectId: string;
}

export function getBuildSizeUrl(params: BuildLinkParams): string | null {
  const {organizationSlug, projectId, baseArtifactId} = params;

  if (!baseArtifactId) {
    return null;
  }

  return `/organizations/${organizationSlug}/explore/build/${baseArtifactId}/size/?project=${projectId}`;
}

export function getBuildInstallUrl(params: BuildLinkParams): string | null {
  const {organizationSlug, projectId, baseArtifactId} = params;

  if (!baseArtifactId) {
    return null;
  }

  return `/organizations/${organizationSlug}/explore/build/${baseArtifactId}/install?project=${projectId}`;
}

export function getBuildCompareUrl(params: {
  headArtifactId: string;
  organizationSlug: string;
  projectId: string;
  baseArtifactId?: string;
}): string {
  const {organizationSlug, projectId, headArtifactId, baseArtifactId} = params;

  let path = `/organizations/${organizationSlug}/explore/build/compare/${headArtifactId}`;
  if (baseArtifactId) {
    path += `/${baseArtifactId}`;
  }
  path += `?project=${projectId}`;

  return path;
}

export function getBuildListUrl(params: {
  organizationSlug: string;
  projectId: string;
}): string {
  const {organizationSlug, projectId} = params;
  return `/organizations/${organizationSlug}/explore/build/?project=${projectId}`;
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
