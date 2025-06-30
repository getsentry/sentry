import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
import {
  isEAPSpanNode,
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/traceGuards';
import {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

export function TraceProfiles({tree}: {tree: TraceTree}) {
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
        traceAnalytics.trackViewTransactionProfile(organization);
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
                organization,
                profilerId: profile.profiler_id,
                start: new Date(node.space[0]).toISOString(),
                end: new Date(node.space[0] + node.space[1]).toISOString(),
                projectSlug: node.metadata.project_slug as string,
                query,
              })
            : generateProfileFlamechartRouteWithQuery({
                organization,
                projectSlug: node.metadata.project_slug as string,
                profileId: profile.profile_id,
                query,
              });

        const profileOrProfilerId =
          'profiler_id' in profile ? profile.profiler_id : profile.profile_id;

        if (isTransactionNode(node)) {
          const event = (
            <Fragment>
              <PlatformIcon
                platform={projectLookup[node.value.project_slug] ?? 'default'}
              />
              <span>{node.value['transaction.op']}</span> —{' '}
              <span>{node.value.transaction}</span>
            </Fragment>
          );
          return (
            <ProfilesTableRow key={index}>
              <div>{event}</div>
              <div>
                <Link to={link} onClick={() => onProfileLinkClick(profile)}>
                  {profileOrProfilerId.substring(0, 8)}
                </Link>
              </div>
            </ProfilesTableRow>
          );
        }
        if (isSpanNode(node) || isEAPSpanNode(node)) {
          const spanId =
            'span_id' in node.value ? node.value.span_id : node.value.event_id;
          const event = (
            <Fragment>
              {node.value.project_slug && (
                <PlatformIcon
                  platform={projectLookup[node.value.project_slug] ?? 'default'}
                />
              )}
              <span>{node.value.op ?? '<unknown>'}</span> —{' '}
              <span className="TraceDescription" title={node.value.description}>
                {node.value.description
                  ? node.value.description.length > 100
                    ? node.value.description.slice(0, 100).trim() + '\u2026'
                    : node.value.description
                  : (spanId ?? 'unknown')}
              </span>
            </Fragment>
          );
          return (
            <ProfilesTableRow key={index}>
              <div>{event}</div>
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
  display: grid !important;
  grid-template-columns: 1fr min-content;
  grid-template-rows: auto;
  width: 100%;
  border: 1px solid ${p => p.theme.border};
  border-radius: ${p => p.theme.borderRadius};

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
    background-color: ${p => p.theme.background};
    border-top-left-radius: ${p => p.theme.borderRadius};
    border-top-right-radius: ${p => p.theme.borderRadius};
  }

  &:not(:last-child) {
    border-bottom: 1px solid ${p => p.theme.border};
  }
`;

const ProfilesTableTitle = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSize.md};
  font-weight: ${p => p.theme.fontWeight.bold};
  padding: 0 ${space(0.5)};
`;
