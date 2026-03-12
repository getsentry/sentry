import {useRef} from 'react';
import styled from '@emotion/styled';

import ErrorBoundary from 'sentry/components/errorBoundary';
import {
  TreeColumn,
  TreeContainer,
} from 'sentry/components/events/eventTags/eventTagsTree';
import {useIssueDetailsColumnCount} from 'sentry/components/events/eventTags/util';
import {KeyValueData} from 'sentry/components/keyValueData';
import ExternalLink from 'sentry/components/links/externalLink';
import {LoadingError} from 'sentry/components/loadingError';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import type {Event} from 'sentry/types/event';
import type {KeyValueListDataItem} from 'sentry/types/group';
import getApiUrl from 'sentry/utils/api/getApiUrl';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {SectionKey} from 'sentry/views/issueDetails/streamline/context';
import {InterimSection} from 'sentry/views/issueDetails/streamline/interimSection';
import {
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formatBuildName,
  getBaseBuildPath,
} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  getLabels,
  getReadablePlatformLabel,
} from 'sentry/views/preprod/utils/labelUtils';
import {
  getBranchUrl,
  getPrUrl,
  getRepoUrl,
  getShaUrl,
} from 'sentry/views/preprod/utils/vcsLinkUtils';

function EventPreprodBuildInfoContent({headArtifactId}: {headArtifactId: string}) {
  const organization = useOrganization();
  const containerRef = useRef<HTMLDivElement>(null);
  const columnCount = useIssueDetailsColumnCount(containerRef);

  const query = useApiQuery<BuildDetailsApiResponse>(
    [
      getApiUrl(
        '/organizations/$organizationIdOrSlug/preprodartifacts/$headArtifactId/build-details/',
        {
          path: {
            organizationIdOrSlug: organization.slug,
            headArtifactId,
          },
        }
      ),
    ],
    {staleTime: 0}
  );

  // Always render the container so the ref is attached and useIssueDetailsColumnCount
  // can measure width. Without this, the ref is null during loading, columnCount
  // initializes to 1, and never updates when data arrives.
  if (query.isLoading) {
    return (
      <BuildInfoContainer columnCount={columnCount} ref={containerRef}>
        <LoadingIndicator />
      </BuildInfoContainer>
    );
  }

  if (query.isError) {
    return (
      <BuildInfoContainer columnCount={columnCount} ref={containerRef}>
        <LoadingError message={t('Failed to load build info.')} onRetry={query.refetch} />
      </BuildInfoContainer>
    );
  }

  const data = query.data;
  if (!data) {
    return null;
  }

  const {app_info, vcs_info, size_info} = data;
  const platform = app_info.platform ?? undefined;
  const labels = getLabels(platform);

  // Left column: platform, build, base build, sizes
  const buildItems: KeyValueListDataItem[] = [];

  if (platform) {
    buildItems.push({
      key: 'platform',
      subject: t('Platform'),
      value: getReadablePlatformLabel(platform),
    });
  }

  const buildName = formatBuildName(app_info.version, app_info.build_number);
  if (buildName) {
    const buildPath = getBaseBuildPath(
      {organizationSlug: organization.slug, baseArtifactId: headArtifactId},
      'size'
    );
    buildItems.push({
      key: 'build',
      subject: t('Build'),
      value: buildName,
      action: buildPath ? {link: buildPath} : undefined,
    });
  }

  const baseBuildName = data.base_build_info
    ? formatBuildName(data.base_build_info.version, data.base_build_info.build_number)
    : null;
  if (baseBuildName) {
    const baseBuildPath = getBaseBuildPath(
      {
        organizationSlug: organization.slug,
        baseArtifactId: data.base_artifact_id ?? undefined,
      },
      'size'
    );
    buildItems.push({
      key: 'base-build',
      subject: t('Base Build'),
      value: baseBuildName,
      action: baseBuildPath ? {link: baseBuildPath} : undefined,
    });
  }

  if (isSizeInfoCompleted(size_info)) {
    const installSize = formattedPrimaryMetricInstallSize(size_info);
    if (installSize !== '-') {
      buildItems.push({
        key: 'install-size',
        subject: labels.installSizeLabel,
        value: installSize,
      });
    }

    const downloadSize = formattedPrimaryMetricDownloadSize(size_info);
    if (downloadSize !== '-') {
      buildItems.push({
        key: 'download-size',
        subject: labels.downloadSizeLabel,
        value: downloadSize,
      });
    }
  }

  // Right column: repo, branch, PR, sha, base sha
  const gitItems: KeyValueListDataItem[] = [];

  if (vcs_info.head_repo_name) {
    const repoUrl = getRepoUrl(vcs_info, vcs_info.head_repo_name);
    gitItems.push({
      key: 'repo',
      subject: t('Repo'),
      value: repoUrl ? (
        <ExternalLink href={repoUrl}>{vcs_info.head_repo_name}</ExternalLink>
      ) : (
        vcs_info.head_repo_name
      ),
    });
  }

  if (vcs_info.head_ref) {
    const branchUrl = getBranchUrl(vcs_info, vcs_info.head_ref);
    gitItems.push({
      key: 'branch',
      subject: t('Branch'),
      value: branchUrl ? (
        <ExternalLink href={branchUrl}>{vcs_info.head_ref}</ExternalLink>
      ) : (
        vcs_info.head_ref
      ),
    });
  }

  if (vcs_info.pr_number) {
    const prUrl = getPrUrl(vcs_info);
    const prLabel = `#${vcs_info.pr_number}`;
    gitItems.push({
      key: 'pr',
      subject: t('PR'),
      value: prUrl ? <ExternalLink href={prUrl}>{prLabel}</ExternalLink> : prLabel,
    });
  }

  if (vcs_info.head_sha) {
    const shaUrl = getShaUrl(vcs_info, vcs_info.head_sha);
    gitItems.push({
      key: 'sha',
      subject: t('SHA'),
      value: shaUrl ? (
        <ExternalLink href={shaUrl}>{vcs_info.head_sha.slice(0, 7)}</ExternalLink>
      ) : (
        vcs_info.head_sha.slice(0, 7)
      ),
    });
  }

  if (vcs_info.base_sha) {
    const baseShaUrl = getShaUrl(vcs_info, vcs_info.base_sha, true);
    gitItems.push({
      key: 'base-sha',
      subject: t('Base SHA'),
      value: baseShaUrl ? (
        <ExternalLink href={baseShaUrl}>{vcs_info.base_sha.slice(0, 7)}</ExternalLink>
      ) : (
        vcs_info.base_sha.slice(0, 7)
      ),
    });
  }

  if (buildItems.length === 0 && gitItems.length === 0) {
    return null;
  }

  return (
    <BuildInfoContainer columnCount={columnCount} ref={containerRef}>
      {buildItems.length > 0 && (
        <TreeColumn key="build">
          {buildItems.map(item => (
            <KeyValueData.Content key={item.key} item={item} disableFormattedData />
          ))}
        </TreeColumn>
      )}
      {gitItems.length > 0 && (
        <TreeColumn key="git">
          {gitItems.map(item => (
            <KeyValueData.Content key={item.key} item={item} disableFormattedData />
          ))}
        </TreeColumn>
      )}
    </BuildInfoContainer>
  );
}

const BuildInfoContainer = styled(TreeContainer)`
  margin-top: 0;
  font-size: ${p => p.theme.font.size.sm};
`;

interface Props {
  event: Event;
}

function EventPreprodBuildInfo({event}: Props) {
  const headArtifactId = event.occurrence?.evidenceData?.headArtifactId;
  if (!headArtifactId) {
    return null;
  }
  return (
    <InterimSection title={t('Build Info')} type={SectionKey.PREPROD_BUILD_METADATA}>
      <ErrorBoundary mini>
        <EventPreprodBuildInfoContent headArtifactId={headArtifactId} />
      </ErrorBoundary>
    </InterimSection>
  );
}

export {EventPreprodBuildInfo};
