import {css} from '@emotion/react';
import styled from '@emotion/styled';

import {Flex} from '@sentry/scraps/layout';
import {Link} from '@sentry/scraps/link';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCalendar,
  IconCode,
  IconCommit,
  IconDownload,
  IconMobile,
  IconTag,
} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {
  getBuildNumber,
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
  formattedSizeDiff,
  getTrend,
} from 'sentry/views/preprod/utils/labelUtils';

interface BuildItemProps {
  build: BuildDetailsApiResponse;
  /** Download size change vs this build. */
  downloadSizeDelta?: number;
  /** Install size change vs this build. */
  installSizeDelta?: number;
  /** Selection state, used by the base-build picker. */
  isSelected?: boolean;
  /** When set, the card links to this path instead of being selectable. */
  linkTo?: string;
  /** Click handler fired before navigation in link mode (e.g. analytics). */
  onClick?: () => void;
  /** Selection handler, used by the base-build picker. */
  onSelect?: () => void;
}

export function BuildItem({
  build,
  downloadSizeDelta,
  installSizeDelta,
  isSelected,
  linkTo,
  onClick,
  onSelect,
}: BuildItemProps) {
  if (linkTo) {
    return (
      <BuildItemLink to={linkTo} onClick={onClick}>
        <BuildItemDetails
          build={build}
          installSizeDelta={installSizeDelta}
          downloadSizeDelta={downloadSizeDelta}
        />
      </BuildItemLink>
    );
  }

  return (
    <BuildItemContainer
      onClick={onSelect}
      isSelected={Boolean(isSelected)}
      align="center"
      gap="md"
    >
      <BuildItemDetails
        build={build}
        installSizeDelta={installSizeDelta}
        downloadSizeDelta={downloadSizeDelta}
      />
      <Radio checked={Boolean(isSelected)} onChange={onSelect} />
    </BuildItemContainer>
  );
}

function BuildItemDetails({
  build,
  downloadSizeDelta,
  installSizeDelta,
}: {
  build: BuildDetailsApiResponse;
  downloadSizeDelta?: number;
  installSizeDelta?: number;
}) {
  const prNumber = build.vcs_info?.pr_number;
  const commitHash = build.vcs_info?.head_sha?.substring(0, 7);
  const branchName = build.vcs_info?.head_ref;
  const dateAdded = build.app_info?.date_added;
  const sizeInfo = build.size_info;
  const version = build.app_info?.version;
  const buildNumber = getBuildNumber(build.app_info);

  const hasGitInfo = Boolean(prNumber || branchName || commitHash);
  const versionInfo = formatVersionInfo(version, buildNumber);

  return (
    <Flex direction="column" gap="sm" flex={1}>
      {(hasGitInfo || versionInfo) && (
        <Flex align="center" gap="md">
          {(prNumber || branchName) && <IconBranch size="xs" variant="muted" />}
          {prNumber && (
            <Flex align="center" gap="sm">
              <Text>#{prNumber}</Text>
            </Flex>
          )}
          {branchName && <BuildItemBranchTag>{branchName}</BuildItemBranchTag>}
          {commitHash && (
            <Flex align="center" gap="sm">
              <IconCommit size="xs" variant="muted" />
              <Text>{commitHash}</Text>
            </Flex>
          )}
          {versionInfo && (
            <Flex align="center" gap="sm">
              <IconTag size="xs" variant="muted" />
              <Text>{versionInfo}</Text>
            </Flex>
          )}
        </Flex>
      )}

      <Flex align="center" gap="md">
        {dateAdded && (
          <Flex align="center" gap="sm">
            <IconCalendar size="xs" variant="muted" />
            <TimeSince date={dateAdded} />
          </Flex>
        )}
        {build.app_info?.build_configuration && (
          <Flex align="center" gap="sm">
            <IconMobile size="xs" variant="muted" />
            <Tooltip title={t('Build configuration')}>
              <Text monospace>{build.app_info.build_configuration}</Text>
            </Tooltip>
          </Flex>
        )}
        {isSizeInfoCompleted(sizeInfo) && (
          <Flex align="center" gap="sm">
            <IconCode size="xs" variant="muted" />
            <Text>{formattedPrimaryMetricInstallSize(sizeInfo)}</Text>
            {installSizeDelta !== undefined && <SizeDelta diff={installSizeDelta} />}
          </Flex>
        )}
        {isSizeInfoCompleted(sizeInfo) && (
          <Flex align="center" gap="sm">
            <IconDownload size="xs" variant="muted" />
            <Text>{formattedPrimaryMetricDownloadSize(sizeInfo)}</Text>
            {downloadSizeDelta !== undefined && <SizeDelta diff={downloadSizeDelta} />}
          </Flex>
        )}
      </Flex>
    </Flex>
  );
}

// Signed size change (head - base) shown inline next to a size, colored by trend.
function SizeDelta({diff}: {diff: number}) {
  const trend = getTrend(diff);
  return (
    <Text variant={trend.variant} size="sm" tabular>
      {formattedSizeDiff(diff) || '0 B'}
    </Text>
  );
}

// Combines version + build number into a display string, e.g. "v1.2.3 (456)".
function formatVersionInfo(
  version?: string | null,
  buildNumber?: string | null
): string | null {
  if (!version && !buildNumber) {
    return null;
  }

  if (version && buildNumber) {
    return `v${version} (${buildNumber})`;
  }

  if (version) {
    return `v${version}`;
  }

  return `(${buildNumber})`;
}

const BuildItemContainer = styled(Flex)<{isSelected: boolean}>`
  border: 1px solid
    ${p =>
      p.isSelected
        ? p.theme.tokens.border.accent.vibrant
        : p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.colors.surface200};
  }

  ${p =>
    p.isSelected &&
    css`
      background-color: ${p.theme.tokens.background.tertiary};
    `}
`;

const BuildItemLink = styled(Link)`
  display: block;
  border: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  color: inherit;

  &:hover {
    background-color: ${p => p.theme.colors.surface200};
    color: inherit;
  }
`;

const BuildItemBranchTag = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.colors.gray100};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.accent};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;
