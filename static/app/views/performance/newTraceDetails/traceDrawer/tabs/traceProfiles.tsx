import {useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {trackAnalytics} from 'sentry/utils/analytics';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';

import {isSpanNode, isTransactionNode} from '../../traceGuards';
import {TraceTree} from '../../traceModels/traceTree';
import type {TraceTreeNode} from '../../traceModels/traceTreeNode';

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

  const onProfileLinkClick = useCallback(
    (profile: TraceTree.Profile) => {
      if ('profiler_id' in profile) {
        traceAnalytics.trackViewContinuousProfile(organization);
      } else {
        trackAnalytics('profiling_views.go_to_flamegraph', {
          organization,
          source: 'performance.trace_view',
        });
      }
    },
    [organization]
  );

  return (
    <ProfilesTable>
      <ProfilesTableRow>
        <ProfilesTableTitle>{t('Profiled Events')}</ProfilesTableTitle>
        <ProfilesTableTitle>{t('Profile')}</ProfilesTableTitle>
      </ProfilesTableRow>

      {profiles.map((node, index) => {
        const profile = node.profiles?.[0];

        if (!profile) {
          return null;
        }

        const query = isTransactionNode(node)
          ? {
              eventId: node.value.event_id,
            }
          : isSpanNode(node)
            ? {
                eventId: TraceTree.ParentTransaction(node)?.value?.event_id,
              }
            : {};

        const link =
          'profiler_id' in profile
            ? generateContinuousProfileFlamechartRouteWithQuery({
                orgSlug: organization.slug,
                profilerId: profile.profiler_id,
                start: new Date(node.space[0]).toISOString(),
                end: new Date(node.space[0] + node.space[1]).toISOString(),
                projectSlug: node.metadata.project_slug as string,
                query,
              })
            : generateProfileFlamechartRouteWithQuery({
                orgSlug: organization.slug,
                projectSlug: node.metadata.project_slug as string,
                profileId: profile.profile_id,
                query,
              });

        const profileOrProfilerId =
          'profiler_id' in profile ? profile.profiler_id : profile.profile_id;

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
                <Link to={link} onClick={() => onProfileLinkClick(profile)}>
                  {profileOrProfilerId.substring(0, 8)}
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
                <Link to={link} onClick={() => onProfileLinkClick(profile)}>
                  {profileOrProfilerId.substring(0, 8)}
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
