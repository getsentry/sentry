import {useState} from 'react';
import styled from '@emotion/styled';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {Stack} from 'sentry/components/core/layout';
import {Flex} from 'sentry/components/core/layout/flex';
import {Radio} from 'sentry/components/core/radio';
import {Text} from 'sentry/components/core/text';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {IconBranch} from 'sentry/components/prevent/branchSelector/iconBranch';
import {
  IconClose,
  IconCode,
  IconCommit,
  IconDownload,
  IconFocus,
  IconLock,
  IconTelescope,
} from 'sentry/icons';
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

  const headPrNumber = headBuildDetails.vcs_info?.pr_number;
  const headSha = headBuildDetails.vcs_info?.head_sha?.substring(0, 7);
  const headBranchName = headBuildDetails.vcs_info?.head_ref;

  const basePrNumber = selectedBaseBuild?.vcs_info?.pr_number;
  const baseSha = selectedBaseBuild?.vcs_info?.head_sha?.substring(0, 7);
  const baseBranchName = selectedBaseBuild?.vcs_info?.head_ref;

  const queryParams: Record<string, any> = {
    per_page: 25,
    state: BuildDetailsState.PROCESSED,
    app_id: headBuildDetails.app_info?.app_id,
    build_version: headBuildDetails.app_info?.version,
    // TODO: Add build_configuration when field in API response
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
      <Flex align="center" gap="lg" width="100%" justify="center">
        <Flex align="center" gap="sm">
          <IconLock size="xs" locked />
          <Text bold>{t('Your build:')}</Text>
          <Text size="sm" variant="accent" bold>
            {headPrNumber && `#${headPrNumber} `}
            {headSha && (
              <Flex align="center" gap="xs">
                <IconCommit size="xs" />
                {headSha}
              </Flex>
            )}
          </Text>
          <BuildBranch>
            <Text size="sm" variant="muted">
              {headBranchName}
            </Text>
          </BuildBranch>
        </Flex>

        <Text>{t('vs')}</Text>

        <Flex align="center" gap="sm">
          {selectedBaseBuild ? (
            <SelectedBaseBuild align="center" gap="sm">
              <IconFocus size="xs" color="purple400" />
              <Text size="sm" variant="accent" bold>
                {t('Comparison:')}
              </Text>
              <Text size="sm" variant="accent" bold>
                {basePrNumber && `#${basePrNumber} `}
                {baseSha && (
                  <Flex align="center" gap="xs">
                    <IconCommit size="xs" color="purple400" />
                    {baseSha}
                  </Flex>
                )}
              </Text>
              <BaseBuildBranch>
                <Text size="sm" variant="muted">
                  {baseBranchName}
                </Text>
              </BaseBuildBranch>
              <Button
                onClick={e => {
                  e.stopPropagation();
                  setSelectedBaseBuild(undefined);
                }}
                size="zero"
                priority="transparent"
                borderless
                aria-label={t('Clear base build')}
                icon={<IconClose size="xs" color="purple400" />}
              />
            </SelectedBaseBuild>
          ) : (
            <SelectBuild>
              <Text size="sm">{t('Select a build')}</Text>
            </SelectBuild>
          )}
        </Flex>

        <Flex align="center" gap="sm">
          <Button
            onClick={() => {
              if (selectedBaseBuild) {
                triggerComparison({
                  baseArtifactId: selectedBaseBuild.id.toString(),
                  headArtifactId: headBuildDetails.id.toString(),
                });
              }
            }}
            disabled={!selectedBaseBuild || isComparing}
            priority="primary"
            icon={<IconTelescope size="sm" />}
          >
            {isComparing ? t('Comparing...') : t('Compare builds')}
          </Button>
        </Flex>
      </Flex>

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

const BuildBranch = styled('span')`
  padding: ${p => p.theme.space.xs} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const BaseBuildBranch = styled('span')`
  padding: ${p => p.theme.space['2xs']} ${p => p.theme.space.sm};
  background-color: ${p => p.theme.gray100};
  border-radius: ${p => p.theme.borderRadius};
`;

const SelectBuild = styled('div')`
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  border-style: dashed;
  padding: ${p => p.theme.space.md} ${p => p.theme.space.lg};
`;

const SelectedBaseBuild = styled(Flex)`
  background-color: ${p => p.theme.surface100};
  border: 1px solid ${p => p.theme.focusBorder};
  border-radius: ${p => p.theme.borderRadius};
  padding: ${p => p.theme.space.sm} ${p => p.theme.space.md};
`;

interface BuildItemProps {
  build: BuildDetailsApiResponse;
  isSelected: boolean;
  onSelect: () => void;
}

function BuildItem({build, isSelected, onSelect}: BuildItemProps) {
  const prNumber = build.vcs_info?.pr_number;
  const commitHash = build.vcs_info?.head_sha?.substring(0, 7);
  const branchName = build.vcs_info?.head_ref;
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
        <Flex align="center" gap="sm">
          {(prNumber || branchName) && <IconBranch size="xs" color="gray300" />}
          {prNumber && (
            <Flex align="center" gap="xs">
              <Text>#{prNumber}</Text>
            </Flex>
          )}
          {branchName && (
            <BuildItemBranchTag>{build.vcs_info?.head_ref}</BuildItemBranchTag>
          )}
          {commitHash && (
            <Flex align="center" gap="xs">
              <IconCommit size="xs" color="gray300" />
              <Text>{commitHash}</Text>
            </Flex>
          )}
        </Flex>
        <Flex align="center" gap="md">
          {/* TODO: Add created at when field in API */}
          {downloadSize && (
            <Flex align="center" gap="xs">
              <IconDownload size="xs" color="gray300" />
              <Text>{formatBytesBase10(downloadSize)}</Text>
            </Flex>
          )}
          {installSize && (
            <Flex align="center" gap="xs">
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
