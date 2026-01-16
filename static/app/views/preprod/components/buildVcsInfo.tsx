import {LinkButton} from '@sentry/scraps/button/linkButton';
import {Container, Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {Link} from 'sentry/components/core/link';
import {
  KeyValueData,
  type KeyValueDataContentProps,
} from 'sentry/components/keyValueData';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {BuildDetailsApiResponse} from 'sentry/views/preprod/types/buildDetailsTypes';
import {
  formatBuildName,
  getBaseBuildPath,
} from 'sentry/views/preprod/utils/buildLinkUtils';
import {
  getBranchUrl,
  getPrUrl,
  getRepoUrl,
  getShaUrl,
} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface BuildVcsInfoProps {
  buildDetailsData: BuildDetailsApiResponse;
  projectId: string | null;
}

export function BuildVcsInfo({buildDetailsData, projectId}: BuildVcsInfoProps) {
  const organization = useOrganization();
  const vcsInfo = buildDetailsData.vcs_info;
  const hasVcsInfo = [
    vcsInfo.head_sha,
    vcsInfo.base_sha,
    vcsInfo.pr_number,
    vcsInfo.head_ref,
    vcsInfo.base_ref,
    vcsInfo.head_repo_name,
    vcsInfo.base_repo_name,
  ].some(value => value !== null && value !== undefined && value !== '');

  const makeLinkableValue = (
    value: string | number | null | undefined,
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
    ...(vcsInfo.base_sha
      ? [
          {
            item: {
              key: 'Base Build',
              subject: 'Base Build',
              value: (() => {
                if (!buildDetailsData.base_build_info) {
                  return '-';
                }
                const buildName = formatBuildName(
                  buildDetailsData.base_build_info.version,
                  buildDetailsData.base_build_info.build_number
                );
                const baseBuildUrl =
                  buildDetailsData.base_artifact_id && projectId
                    ? getBaseBuildPath(
                        {
                          baseArtifactId: buildDetailsData.base_artifact_id,
                          organizationSlug: organization.slug,
                          projectId,
                        },
                        'size'
                      )
                    : null;
                if (!baseBuildUrl || !buildName) {
                  return '-';
                }
                return <Link to={baseBuildUrl}>{buildName}</Link>;
              })(),
            },
          },
        ]
      : []),
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

  return hasVcsInfo ? (
    <KeyValueData.Card title="Build Metadata" contentItems={vcsInfoContentItems} />
  ) : (
    <Container border="primary" radius="md" padding="md" width="100%">
      <Flex direction="column" gap="sm">
        <Text bold>{t('Missing Git metadata')}</Text>
        <Text variant="muted" size="sm">
          {t('Integrate with CI to automate uploading, diffing, and alerting')}
        </Text>
        <LinkButton
          size="sm"
          external
          href="https://docs.sentry.io/product/size-analysis/integrating-into-ci/"
        >
          {t('View CI setup docs')}
        </LinkButton>
      </Flex>
    </Container>
  );
}
