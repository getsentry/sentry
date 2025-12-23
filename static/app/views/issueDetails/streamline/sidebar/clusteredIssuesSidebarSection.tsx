import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex} from 'sentry/components/core/layout';
import {Link} from 'sentry/components/core/link';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {ClusterSummary, TopIssuesResponse} from 'sentry/types/cluster';
import type {Group} from 'sentry/types/group';
import {useApiQuery} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';
import {SidebarSectionTitle} from 'sentry/views/issueDetails/streamline/sidebar/sidebar';

interface Props {
  group: Group;
}

export function ClusteredIssuesSidebarSection({group}: Props) {
  const organization = useOrganization();

  const {data: topIssuesResponse, isPending} = useApiQuery<TopIssuesResponse>(
    [`/organizations/${organization.slug}/top-issues/`],
    {
      staleTime: 60000,
      enabled: organization.features.includes('top-issues-ui'),
    }
  );

  // Check feature flag
  if (!organization.features.includes('top-issues-ui')) {
    return null;
  }

  if (isPending) {
    return <LoadingIndicator size={20} mini />;
  }

  const cluster = topIssuesResponse?.data?.find((c: ClusterSummary) =>
    c.group_ids.includes(Number(group.id))
  );

  if (!cluster) {
    return null;
  }

  const otherIssueIds = cluster.group_ids.filter((id: number) => String(id) !== group.id);

  if (otherIssueIds.length === 0) {
    return null;
  }

  return (
    <Fragment>
      <SidebarSectionTitle>{t('Clustered Issues')}</SidebarSectionTitle>
      <Flex direction="column" gap="sm">
        <ClusterInfo>
          <strong>{cluster.impact || t('Cluster')}</strong>{' '}
          <span style={{color: 'var(--sub-text)'}}>[{cluster.cluster_id}]</span>
        </ClusterInfo>

        <IssueList>
          {otherIssueIds.slice(0, 5).map((id: number) => (
            <IssueItem key={id}>
              <Link to={`/organizations/${organization.slug}/issues/${id}/`}>
                {t('Issue #%s', id)}
              </Link>
            </IssueItem>
          ))}
          {otherIssueIds.length > 5 && (
            <IssueItem>
              +{otherIssueIds.length - 5} {t('more')}
            </IssueItem>
          )}
        </IssueList>
      </Flex>
    </Fragment>
  );
}

const ClusterInfo = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  margin-bottom: ${space(1)};
`;

const IssueList = styled('ul')`
  list-style: none;
  padding: 0;
  margin: 0;
  font-size: ${p => p.theme.fontSize.sm};
`;

const IssueItem = styled('li')`
  margin-bottom: ${space(0.5)};
  ${p => p.theme.overflowEllipsis};
`;
