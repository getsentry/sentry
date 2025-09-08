import {Alert} from 'sentry/components/core/alert';
import {Flex} from 'sentry/components/core/layout';
import {ExternalLink} from 'sentry/components/core/link';
import {
  KeyValueData,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import type {UseApiQueryResult} from 'sentry/utils/queryClient';
import type RequestError from 'sentry/utils/requestError/requestError';
import {BuildDetailsSidebarAppInfo} from 'sentry/views/preprod/buildDetails/sidebar/buildDetailsSidebarAppInfo';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  getBranchUrl,
  getPrUrl,
  getRepoUrl,
  getShaUrl,
} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface BuildDetailsSidebarContentProps {
  artifactId: string;
  buildDetailsQuery: UseApiQueryResult<BuildDetailsApiResponse, RequestError>;
  projectId: string;
}

export function BuildDetailsSidebarContent(props: BuildDetailsSidebarContentProps) {
  const {
    data: buildDetailsData,
    isPending: isBuildDetailsPending,
    isError: isBuildDetailsError,
    error: buildDetailsError,
  } = props.buildDetailsQuery;

  if (isBuildDetailsPending) {
    return <LoadingIndicator />;
  }

  if (isBuildDetailsError) {
    return <Alert type="error">{buildDetailsError?.message}</Alert>;
  }

  if (!buildDetailsData) {
    return <Alert type="error">No build details found</Alert>;
  }

  const vcsInfo = buildDetailsData.vcs_info;

  const makeLinkableValue = (
    value: string | number | undefined,
    url: string | null
  ): React.ReactNode => {
    if (value === undefined || value === null) {
      return '-';
    }
    if (url === null || url === undefined) {
      return value;
    }
    return <ExternalLink href={url}>{value}</ExternalLink>;
  };

  const vcsInfoContentItems: KeyValueDataContentProps[] = [
    {
      item: {
        key: 'SHA',
        subject: 'SHA',
        value: makeLinkableValue(vcsInfo.head_sha, getShaUrl(vcsInfo, vcsInfo.head_sha)),
      },
    },
    {
      item: {
        key: 'Base SHA',
        subject: 'Base SHA',
        value: makeLinkableValue(
          vcsInfo.base_sha,
          getShaUrl(vcsInfo, vcsInfo.base_sha, true)
        ),
      },
    },
    {
      item: {
        key: 'PR Number',
        subject: 'PR Number',
        value: makeLinkableValue(vcsInfo.pr_number, getPrUrl(vcsInfo)),
      },
    },
    {
      item: {
        key: 'Branch',
        subject: 'Branch',
        value: makeLinkableValue(
          vcsInfo.head_ref,
          getBranchUrl(vcsInfo, vcsInfo.head_ref)
        ),
      },
    },
    {
      item: {
        key: 'Base Branch',
        subject: 'Base Branch',
        value: makeLinkableValue(
          vcsInfo.base_ref,
          getBranchUrl(vcsInfo, vcsInfo.base_ref, true)
        ),
      },
    },
    {
      item: {
        key: 'Repo Name',
        subject: 'Repo Name',
        value: makeLinkableValue(
          vcsInfo.head_repo_name,
          getRepoUrl(vcsInfo, vcsInfo.head_repo_name)
        ),
      },
    },
  ];

  // Base repo name is only available for forks, so we shouldn't show it if it's not present
  // Also hide it if it's the same as the head repo name
  if (vcsInfo.base_repo_name && vcsInfo.base_repo_name !== vcsInfo.head_repo_name) {
    vcsInfoContentItems.push({
      item: {
        key: 'Base Repo Name',
        subject: 'Base Repo Name',
        value: makeLinkableValue(
          vcsInfo.base_repo_name,
          getRepoUrl(vcsInfo, vcsInfo.base_repo_name)
        ),
      },
    });
  }

  return (
    <Flex direction="column" gap="2xl">
      {/* App info */}
      <BuildDetailsSidebarAppInfo
        appInfo={buildDetailsData.app_info}
        sizeInfo={buildDetailsData.size_info}
        projectId={props.projectId}
        artifactId={props.artifactId}
      />

      {/* VCS info */}
      <KeyValueData.Card title="Git details" contentItems={vcsInfoContentItems} />
    </Flex>
  );
}
