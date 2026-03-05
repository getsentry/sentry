import getApiUrl from 'sentry/utils/api/getApiUrl';

interface BuildLinkParams {
  organizationSlug: string;
  baseArtifactId?: string;
}

export function getBaseBuildPath(
  params: BuildLinkParams,
  viewType?: 'size' | 'install'
): string | undefined {
  const {organizationSlug, baseArtifactId} = params;

  if (!baseArtifactId) {
    return undefined;
  }

  return `/organizations/${organizationSlug}/preprod/${viewType}/${baseArtifactId}/`;
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
  baseArtifactId?: string;
}): string {
  const {organizationSlug, headArtifactId, baseArtifactId} = params;

  if (baseArtifactId) {
    return `/organizations/${organizationSlug}/preprod/size/compare/${headArtifactId}/${baseArtifactId}/`;
  }

  return `/organizations/${organizationSlug}/preprod/size/compare/${headArtifactId}/`;
}

export function getListBuildPath(params: {organizationSlug: string}): string {
  const {organizationSlug} = params;
  return `/organizations/${organizationSlug}/preprod/`;
}

export function getCompareApiUrl(params: {
  baseArtifactId: string;
  headArtifactId: string;
  organizationSlug: string;
}) {
  const {organizationSlug, headArtifactId, baseArtifactId} = params;
  return getApiUrl(
    '/organizations/$organizationIdOrSlug/preprodartifacts/size-analysis/compare/$headArtifactId/$baseArtifactId/',
    {
      path: {
        organizationIdOrSlug: organizationSlug,
        headArtifactId,
        baseArtifactId,
      },
    }
  );
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
