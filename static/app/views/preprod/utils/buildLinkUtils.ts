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
