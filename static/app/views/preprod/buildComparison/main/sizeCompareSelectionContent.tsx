import {useState} from 'react';
import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Stack} from '@sentry/scraps/layout';
import {Flex} from '@sentry/scraps/layout/flex';
import {Radio} from '@sentry/scraps/radio';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import TimeSince from 'sentry/components/timeSince';
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
import ProjectsStore from 'sentry/stores/projectsStore';
import {trackAnalytics} from 'sentry/utils/analytics';
import parseApiError from 'sentry/utils/parseApiError';
import parseLinkHeader from 'sentry/utils/parseLinkHeader';
import {useApiQuery, useMutation, type UseApiQueryResult} from 'sentry/utils/queryClient';
import {decodeScalar} from 'sentry/utils/queryString';
import type RequestError from 'sentry/utils/requestError/requestError';
import useLocationQuery from 'sentry/utils/url/useLocationQuery';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  BuildDetailsState,
  isSizeInfoCompleted,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';
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
  const {projectId} = useParams<{
    projectId: string;
  }>();
  const project = ProjectsStore.getBySlug(projectId);
  const projectType = project?.platform ?? null;
  const [selectedBaseBuild, setSelectedBaseBuild] = useState<
    BuildDetailsApiResponse | undefined
  >(baseBuildDetails);
  const [searchQuery, setSearchQuery] = useState('');

  const {cursor} = useLocationQuery({
    fields: {
      cursor: decodeScalar,
    },
  });

  const queryParams: Record<string, any> = {
    per_page: 25,
    state: BuildDetailsState.PROCESSED,
    app_id: headBuildDetails.app_info?.app_id,
    build_configuration: headBuildDetails.app_info?.build_configuration,
    ...(cursor && {cursor}),
    ...(searchQuery && {query: searchQuery}),
    ...(projectId && {project: projectId}),
  };

  const buildsQuery: UseApiQueryResult<ListBuildsApiResponse, RequestError> =
    useApiQuery<ListBuildsApiResponse>(
      [
        `/organizations/${organization.slug}/preprodartifacts/list-builds/`,
        {query: queryParams},
      ],
      {
        staleTime: 0,
        enabled: !!projectId,
      }
    );

  const pageLinks = buildsQuery.getResponseHeader?.('Link') || null;

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
        `/projects/${organization.slug}/${projectId}/preprodartifacts/size-analysis/compare/${headArtifactId}/${baseArtifactId}/`,
        {
          method: 'POST',
        }
      );
    },
    onSuccess: () => {
      navigate(
        `/organizations/${organization.slug}/preprod/${projectId}/compare/${headBuildDetails.id}/${selectedBaseBuild?.id}/`
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
                `/organizations/${organization.slug}/preprod/${projectId}/compare/${headBuildDetails.id}/`,
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
      {buildsQuery.data && (
        <Stack gap="md">
          {buildsQuery.data.builds.map(build => {
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
                    project_slug: projectId,
                    platform:
                      build.app_info?.platform ??
                      headBuildDetails.app_info?.platform ??
                      null,
                    project_type: projectType,
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
            {(prNumber || branchName) && <IconBranch size="xs" color="gray300" />}
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
                <IconCommit size="xs" color="gray300" />
                <Text>{commitHash}</Text>
              </Flex>
            )}
            {versionInfo && (
              <Flex align="center" gap="sm">
                <IconTag size="xs" color="gray300" />
                <Text>{versionInfo}</Text>
              </Flex>
            )}
          </Flex>
        )}

        <Flex align="center" gap="md">
          {dateAdded && (
            <Flex align="center" gap="sm">
              <IconCalendar size="xs" color="gray300" />
              <TimeSince date={dateAdded} />
            </Flex>
          )}
          {build.app_info?.build_configuration && (
            <Flex align="center" gap="sm">
              <IconMobile size="xs" color="gray300" />
              <Tooltip title={t('Build configuration')}>
                <Text monospace>{build.app_info.build_configuration}</Text>
              </Tooltip>
            </Flex>
          )}
          {isSizeInfoCompleted(sizeInfo) && (
            <Flex align="center" gap="sm">
              <IconCode size="xs" color="gray300" />
              <Text>{formattedPrimaryMetricInstallSize(sizeInfo)}</Text>
            </Flex>
          )}
          {isSizeInfoCompleted(sizeInfo) && (
            <Flex align="center" gap="sm">
              <IconDownload size="xs" color="gray300" />
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
  border: 1px solid ${p => (p.isSelected ? p.theme.focusBorder : p.theme.border)};
  border-radius: ${p => p.theme.radius.md};
  padding: ${p => p.theme.space.md};
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.colors.surface200};
  }

  ${p =>
    p.isSelected &&
    `
      background-color: ${p.theme.colors.surface300};
    `}
`;

const BuildItemBranchTag = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.colors.gray100};
  border-radius: ${p => p.theme.radius.md};
  color: ${p => p.theme.colors.blue500};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
`;
