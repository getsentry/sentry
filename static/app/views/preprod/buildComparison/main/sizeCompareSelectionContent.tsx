import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Stack} from 'sentry/components/core/layout';
import {Flex} from 'sentry/components/core/layout/flex';
import {Radio} from 'sentry/components/core/radio';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import TimeSince from 'sentry/components/timeSince';
import {IconCalendar, IconCode, IconCommit, IconDownload} from 'sentry/icons';
import {IconBranch} from 'sentry/icons/iconBranch';
import {t} from 'sentry/locale';
import {formatBytesBase10} from 'sentry/utils/bytes/formatBytesBase10';
import {useApiQuery, useMutation, type UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import useApi from 'sentry/utils/useApi';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';
import {
  BuildDetailsState,
  type BuildDetailsApiResponse,
} from 'sentry/views/preprod/types/buildDetailsTypes';
import type {ListBuildsApiResponse} from 'sentry/views/preprod/types/listBuildsTypes';

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
  const [selectedBaseBuild, setSelectedBaseBuild] = useState<
    BuildDetailsApiResponse | undefined
  >(baseBuildDetails);

  const queryParams: Record<string, any> = {
    per_page: 25,
    state: BuildDetailsState.PROCESSED,
    app_id: headBuildDetails.app_info?.app_id,
    build_configuration: headBuildDetails.app_info?.build_configuration,
  };

  const buildsQuery: UseApiQueryResult<ListBuildsApiResponse, RequestError> =
    useApiQuery<ListBuildsApiResponse>(
      [
        `/projects/${organization.slug}/${projectId}/preprodartifacts/list-builds/`,
        {query: queryParams},
      ],
      {
        staleTime: 0,
        enabled: !!projectId,
      }
    );

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
      addErrorMessage(
        error?.message || t('Failed to trigger comparison. Please try again.')
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

      {buildsQuery.isLoading && <LoadingIndicator />}
      {buildsQuery.isError && <Alert type="error">{buildsQuery.error?.message}</Alert>}
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
                onSelect={() => setSelectedBaseBuild(build)}
              />
            );
          })}
        </Stack>
      )}
    </Stack>
  );
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
  const downloadSize = build.size_info?.download_size_bytes;
  const installSize = build.size_info?.install_size_bytes;

  return (
    <BuildItemContainer
      onClick={onSelect}
      isSelected={isSelected}
      align="center"
      gap="md"
    >
      <Flex direction="column" gap="sm" flex={1}>
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
        </Flex>
        <Flex align="center" gap="md">
          {dateAdded && (
            <Flex align="center" gap="sm">
              <IconCalendar size="xs" color="gray300" />
              <TimeSince date={dateAdded} />
            </Flex>
          )}
          {downloadSize && (
            <Flex align="center" gap="sm">
              <IconDownload size="xs" color="gray300" />
              <Text>{formatBytesBase10(downloadSize)}</Text>
            </Flex>
          )}
          {installSize && (
            <Flex align="center" gap="sm">
              <IconCode size="xs" color="gray300" />
              <Text>{formatBytesBase10(installSize)}</Text>
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
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.md};
  cursor: pointer;

  &:hover {
    background-color: ${p => p.theme.surface200};
  }

  ${p =>
    p.isSelected &&
    `
      background-color: ${p.theme.surface100};
    `}
`;

const BuildItemBranchTag = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
  color: ${p => p.theme.purple400};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: ${p => p.theme.fontWeight.normal};
`;
