import React from 'react';

import {FeatureBadge} from '@sentry/scraps/badge';
import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Heading, Text} from '@sentry/scraps/text';

import {Breadcrumbs, type Crumb} from 'sentry/components/breadcrumbs';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconBranch, IconCommit} from 'sentry/icons';
import {t} from 'sentry/locale';
import useOrganization from 'sentry/utils/useOrganization';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {makeReleasesUrl} from 'sentry/views/preprod/utils/releasesUrl';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface SnapshotHeaderContentProps {
  data: SnapshotDetailsApiResponse;
  projectId: string;
}

export function SnapshotHeaderContent({projectId, data}: SnapshotHeaderContentProps) {
  const organization = useOrganization();
  const {vcs_info} = data;
  const shaUrl = getShaUrl(vcs_info, vcs_info.head_sha);
  const prUrl = getPrUrl(vcs_info);
  const branchUrl = getBranchUrl(vcs_info, vcs_info.head_ref);
  const shortSha = vcs_info.head_sha?.slice(0, 7);

  const breadcrumbs: Crumb[] = [
    {
      to: makeReleasesUrl(organization.slug, projectId, {tab: 'mobile-builds'}),
      label: t('Releases'),
    },
  ];

  return (
    <React.Fragment>
      <Layout.HeaderContent>
        <Flex align="center" gap="sm">
          <Breadcrumbs crumbs={breadcrumbs} />
          <FeatureBadge type="new" />
        </Flex>
        <Layout.Title>
          {/* TODO: Replace with app-id/version when available */}
          <Heading as="h2">{t('Snapshots')}</Heading>
          <Flex align="center" gap="md" wrap="wrap">
            {prUrl && vcs_info.pr_number && (
              <ExternalLink href={prUrl}>
                <Flex align="center" gap="xs">
                  <IconBranch size="xs" />
                  <Text size="sm">#{vcs_info.pr_number}</Text>
                </Flex>
              </ExternalLink>
            )}
            {shaUrl && shortSha && (
              <ExternalLink href={shaUrl}>
                <Flex align="center" gap="xs">
                  <IconCommit size="xs" />
                  <Text size="sm" monospace>
                    {shortSha}
                  </Text>
                </Flex>
              </ExternalLink>
            )}
            {vcs_info.head_ref && (
              <Flex align="center" gap="xs">
                <IconBranch size="xs" />
                {branchUrl ? (
                  <ExternalLink href={branchUrl}>
                    <Text size="sm">{vcs_info.head_ref}</Text>
                  </ExternalLink>
                ) : (
                  <Text size="sm">{vcs_info.head_ref}</Text>
                )}
              </Flex>
            )}
          </Flex>
        </Layout.Title>
      </Layout.HeaderContent>
    </React.Fragment>
  );
}
