import {useState} from 'react';
import styled from '@emotion/styled';
import {useQuery} from '@tanstack/react-query';

import {Alert} from '@sentry/scraps/alert';
import {InputGroup} from '@sentry/scraps/input';
import {Flex, Stack} from '@sentry/scraps/layout';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {LoadingIndicator} from 'sentry/components/loadingIndicator';
import {Pagination} from 'sentry/components/pagination';
import {TimeSince} from 'sentry/components/timeSince';
import {
  IconCalendar,
  IconCode,
  IconCommit,
  IconDownload,
  IconMobile,
  IconSearch,
  IconTag,
} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {trackAnalytics} from 'sentry/utils/analytics';
import {selectJsonWithHeaders} from 'sentry/utils/api/apiOptions';
import {parseApiError} from 'sentry/utils/parseApiError';
import {parseLinkHeader} from 'sentry/utils/parseLinkHeader';
import {useMutation} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type {RequestError} from 'sentry/utils/requestError/requestError';
import {useLocationQuery} from 'sentry/utils/url/useLocationQuery';
import {useApi} from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import {useOrganization} from 'sentry/utils/useOrganization';
import {
  BuildDetailsState,
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import {buildDetailsApiOptions} from 'sentry/views/preprod/utils/buildDetailsApiOptions';
import {
  getCompareApiUrl,
  getCompareBuildPath,
} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  formattedPrimaryMetricDownloadSize,
  formattedPrimaryMetricInstallSize,
} from 'sentry/views/preprod/utils/labelUtils';

import {SizeCompareSelectedBuilds} from './sizeCompareSelectedBuilds';

interface SizeCompareSelectionContentProps {
  headBuildDetails: BuildDetailsApiResponse;
  baseBuildDetails?: BuildDetailsApiResponse;
  onBaseBuildClear?: () => void;
  onBaseBuildSelect?: () => void;
}

export function SizeCompareSelectionContent({
  headBuildDetails,
  baseBuildDetails,
}: SizeCompareSelectionContentProps) {
  const organization = useOrganization();
  const api = useApi({persistInFlight: true});
  const navigate = useNavigate();
  const {cursor} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
    },
  });
  const [selectedBaseBuild, setSelectedBaseBuild] = useState<
    BuildDetailsApiResponse | undefined
  >(baseBuildDetails);
  const [searchQuery, setSearchQuery] = useState('');

  const searchFilters: string[] = [`state:${BuildDetailsState.PROCESSED}`];
  if (headBuildDetails.app_info?.app_id) {
    searchFilters.push(`app_id:"${headBuildDetails.app_info.app_id}"`);
  }
  if (headBuildDetails.app_info?.build_configuration) {
    searchFilters.push(
      `build_configuration_name:"${headBuildDetails.app_info.build_configuration}"`
    );
  }
  if (searchQuery) {
    searchFilters.push(searchQuery);
  }
  const fullQuery = searchFilters.join(' ');

  const buildsQuery = useQuery({
    ...buildDetailsApiOptions({
      organization,
      queryParams: {
        per_page: 25,
        project: headBuildDetails.project_id,
        query: fullQuery,
        ...(cursor && {cursor}),
      },
    }),
    select: selectJsonWithHeaders,
  });

  const pageLinks = buildsQuery.data?.headers.Link || null;

  const parsedLinks = pageLinks ? parseLinkHeader(pageLinks) : {};
  const hasPagination =
    parsedLinks.previous?.results === true || parsedLinks.next?.results === true;

  const {mutate: triggerComparison, isPending: isComparing} = useMutation<
    void,
    RequestError,
    {baseArtifactId: string; headArtifactId: string}
  >({
    mutationFn: ({headArtifactId, baseArtifactId}) => {
      return api.requestPromise(
        getCompareApiUrl({
          organizationSlug: organization.slug,
          headArtifactId,
          baseArtifactId,
        }),
        {method: 'POST'}
      );
    },
    onSuccess: () => {
      navigate(
        getCompareBuildPath({
          organizationSlug: organization.slug,
          headArtifactId: headBuildDetails.id,
          baseArtifactId: selectedBaseBuild?.id,
        })
      );
    },
    onError: error => {
      const errorMessage = parseApiError(error);
      addErrorMessage(
        errorMessage === 'Unknown API Error'
          ? t('Failed to trigger comparison. Please try again.')
          : errorMessage
      );
    },
  });

  return (
    <Stack gap="xl">
      <SizeCompareSelectedBuilds
        isComparing={isComparing}
        headBuildDetails={headBuildDetails}
        baseBuildDetails={selectedBaseBuild}
        onClearBaseBuild={() => setSelectedBaseBuild(undefined)}
        onTriggerComparison={() => {
          if (!selectedBaseBuild) {
            addErrorMessage(t('Please select a base build to compare.'));
            return;
          }

          triggerComparison({
            baseArtifactId: selectedBaseBuild.id.toString(),
            headArtifactId: headBuildDetails.id.toString(),
          });
        }}
      />

      <InputGroup>
        <InputGroup.LeadingItems disablePointerEvents>
          <IconSearch />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          placeholder={t('Search builds')}
          value={searchQuery}
          onChange={e => {
            setSearchQuery(e.target.value);
            // Clear cursor when search query changes to avoid pagination issues
            if (cursor) {
              navigate(
                getCompareBuildPath({
                  organizationSlug: organization.slug,
                  headArtifactId: headBuildDetails.id,
                }),
                {replace: true}
              );
            }
          }}
        />
      </InputGroup>

      {buildsQuery.isLoading && <LoadingIndicator />}
      {buildsQuery.isError && (
        <Alert variant="danger">{buildsQuery.error?.message}</Alert>
      )}
      {buildsQuery.data?.json && (
        <Stack gap="md">
          {buildsQuery.data.json.map(build => {
            if (build.id === headBuildDetails.id) {
              return null;
            }

            return (
              <BuildItem
                key={build.id}
                build={build}
                isSelected={selectedBaseBuild === build}
                onSelect={() => {
                  setSelectedBaseBuild(build);
                  trackAnalytics('preprod.builds.compare.select_base_build', {
                    organization,
                    build_id: build.id,
                    platform:
                      build.app_info?.platform ??
                      headBuildDetails.app_info?.platform ??
                      null,
                  });
                }}
              />
            );
          })}

          {hasPagination && <Pagination pageLinks={pageLinks} />}
        </Stack>
      )}
    </Stack>
  );
}

/**
 * Formats version and build number into a combined string.
 * Examples: "v1.2.3 (456)", "v1.2.3", "(456)", or null
 */
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

interface BuildItemProps {
  build: BuildDetailsApiResponse;
  isSelected: boolean;
  onSelect: () => void;
}

function BuildItem({build, isSelected, onSelect}: BuildItemProps) {
  const prNumber = build.vcs_info?.pr_number;
  const commitHash = build.vcs_info?.head_sha?.substring(0, 7);
  const branchName = build.vcs_info?.head_ref;
  const dateAdded = build.app_info?.date_added;
  const sizeInfo = build.size_info;
  const version = build.app_info?.version;
  const buildNumber = build.app_info?.build_number;

  const hasGitInfo = Boolean(prNumber || branchName || commitHash);
  const versionInfo = formatVersionInfo(version, buildNumber);

  return (
    <BuildItemContainer
      onClick={onSelect}
      isSelected={isSelected}
      align="center"
      gap="md"
    >
      <Flex direction="column" gap="sm" flex={1}>
        {(hasGitInfo || versionInfo) && (
          <Flex align="center" gap="md">
            {(prNumber || branchName) && <IconBranch size="xs" variant="muted" />}
            {prNumber && (
              <Flex align="center" gap="sm">
                <Text>#{prNumber}</Text>
              </Flex>
            )}
            {branchName && (
              <BuildItemBranchTag>{build.vcs_info?.head_ref}</BuildItemBranchTag>
            )}
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
            </Flex>
          )}
          {isSizeInfoCompleted(sizeInfo) && (
            <Flex align="center" gap="sm">
              <IconDownload size="xs" variant="muted" />
              <Text>{formattedPrimaryMetricDownloadSize(sizeInfo)}</Text>
            </Flex>
          )}
        </Flex>
      </Flex>
      <Radio checked={isSelected} onChange={onSelect} />
    </BuildItemContainer>
  );
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
    `
      background-color: ${p.theme.tokens.background.tertiary};
    `}
`;

const BuildItemBranchTag = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.colors.gray100};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.tokens.content.accent};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: ${p => p.theme.font.weight.sans.regular};
`;
