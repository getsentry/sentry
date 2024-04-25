import {Fragment, useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {generateProfileFlamechartRouteWithQuery} from 'sentry/utils/profiling/routes';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {
  isSpanNode,
  isTransactionNode,
} from 'sentry/views/performance/newTraceDetails/guards';
import type {TraceTree} from 'sentry/views/performance/newTraceDetails/traceModels/traceTree';

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

  return (
    <ProfilesTable>
      <ProfilesTableTitle>{t('Profiled Transaction')}</ProfilesTableTitle>
      <ProfilesTableTitle>{t('Profile')}</ProfilesTableTitle>

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
            <Fragment key={index}>
              <div>
                <PlatformIcon
                  platform={projectLookup[node.value.project_slug] ?? 'default'}
                />
                <strong>
                  <span>{node.value['transaction.op']}</span>
                </strong>
                <strong> — </strong>
                <span>{node.value.transaction}</span>
              </div>
              <div>
                <Link to={link} onClick={onClick}>
                  {node.profiles?.[0].profile_id?.substring(0, 8)}
                </Link>
              </div>
            </Fragment>
          );
        }
        if (isSpanNode(node)) {
          return (
            <Fragment key={index}>
              <div>
                <strong>
                  <span>{node.value.op ?? '<unknown>'}</span>
                </strong>
                <strong> — </strong>
                <span className="TraceDescription" title={node.value.description}>
                  {!node.value.description
                    ? node.value.span_id ?? 'unknown'
                    : node.value.description.length > 100
                      ? node.value.description.slice(0, 100).trim() + '\u2026'
                      : node.value.description}
                </span>
              </div>
              <div>
                <Link to={link} onClick={onClick}>
                  {node.profiles?.[0].profile_id?.substring(0, 8)}
                </Link>
              </div>
            </Fragment>
          );
        }
        return null;
      })}
    </ProfilesTable>
  );
}

const ProfilesTable = styled('div')`
  margin-top: ${space(1)};
  padding: 0 ${space(0.5)};
  display: grid !important;
  grid-template-columns: 1fr min-content;
  grid-template-rows: auto;
  width: 100%;

  > div {
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    padding: ${space(0.5)} 0;
  }

  img {
    width: 16px;
    height: 16px;
    margin-right: ${space(0.5)};
  }
`;

const ProfilesTableTitle = styled('div')`
  color: ${p => p.theme.subText};
  font-size: ${p => p.theme.fontSizeMedium};
  font-weight: bold;

  &:not(:first-child) {
    text-align: right;
  }
`;
