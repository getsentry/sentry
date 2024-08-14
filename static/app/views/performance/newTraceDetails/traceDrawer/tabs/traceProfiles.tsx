import {useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {
  TraceTree,
  TraceTreeNode,
} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function TraceProfiles({
  tree,
  onScrollToNode,
}: {
  onScrollToNode: (node: TraceTreeNode<any>) => void;
  tree: TraceTree;
}) {
  const {projects} = useProjects();
  const organization = useOrganization();

  const projectLookup: Record<string, PlatformKey | undefined> = useMemo(() => {
    return projects.reduce<Record<Project['slug'], Project['platform']>>(
      (acc, project) => {
        acc[project.slug] = project.platform;
        return acc;
      },
      {}
    );
  }, [projects]);

  const profiles = useMemo(
    () => Array.from(tree.profiled_events.values()),
    [tree.profiled_events]
  );

  return (
    <ProfilesTable>
      <ProfilesTableRow>
        <ProfilesTableTitle>{t('Profiled Transaction')}</ProfilesTableTitle>
        <ProfilesTableTitle>{t('Profile')}</ProfilesTableTitle>
      </ProfilesTableRow>

      {profiles.map((node, index) => {
        const link = generateProfileFlamechartRouteWithQuery({
          orgSlug: organization.slug,
          projectSlug: node.metadata.project_slug as string,
          profileId: node.profiles?.[0].profile_id as string,
        });
        const onClick = () => {
          trackAnalytics('profiling_views.go_to_flamegraph', {
            organization,
            source: 'performance.trace_view',
          });
        };

        if (isTransactionNode(node)) {
          return (
            <ProfilesTableRow key={index}>
              <div>
                <a onClick={() => onScrollToNode(node)}>
                  <PlatformIcon
                    platform={projectLookup[node.value.project_slug] ?? 'default'}
                  />
                  <span>{node.value['transaction.op']}</span> —{' '}
                  <span>{node.value.transaction}</span>
                </a>
              </div>
              <div>
                <Link to={link} onClick={onClick}>
                  {node.profiles?.[0].profile_id?.substring(0, 8)}
                </Link>
              </div>
            </ProfilesTableRow>
          );
        }
        if (isSpanNode(node)) {
          return (
            <ProfilesTableRow key={index}>
              <div>
                <a onClick={() => onScrollToNode(node)}>
                  <span>{node.value.op ?? '<unknown>'}</span> —{' '}
                  <span className="TraceDescription" title={node.value.description}>
                    {!node.value.description
                      ? node.value.span_id ?? 'unknown'
                      : node.value.description.length > 100
                        ? node.value.description.slice(0, 100).trim() + '\u2026'
                        : node.value.description}
                  </span>
                </a>
              </div>
              <div>
                <Link to={link} onClick={onClick}>
                  {node.profiles?.[0].profile_id?.substring(0, 8)}
                </Link>
              </div>
            </ProfilesTableRow>
          );
        }
        return null;
      })}
    </ProfilesTable>
  );
}

const ProfilesTable = styled('div')`
  margin-top: ${space(1)};
  display: grid !important;
  grid-template-columns: 1fr min-content;
  grid-template-rows: auto;
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};
  overflow: hidden;

  > div {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${space(0.5)} ${space(1)};
  }

  img {
    width: 16px;
    height: 16px;
    margin-right: ${space(0.5)};
  }
`;

const ProfilesTableRow = styled('div')`
  display: grid;
  grid-column: 1 / -1;
  grid-template-columns: subgrid;
  width: 100%;
  padding: ${space(0.5)};
  padding: ${space(0.5)} ${space(2)};

  & > div {
    padding: ${space(0.5)} ${space(1)};
    white-space: nowrap;
    text-overflow: ellipsis;
    overflow: hidden;
  }

  &:first-child {
    background-color: ${p => p.theme.backgroundSecondary};
  }

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const ProfilesTableTitle = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: ${p => p.theme.fontWeightBold};
  padding: 0 ${space(0.5)};
  background-color: ${p => p.theme.backgroundSecondary};
`;
