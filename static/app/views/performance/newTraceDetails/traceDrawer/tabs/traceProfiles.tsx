import {Fragment, useCallback, useMemo} from 'react';
import styled from '@emotion/styled';
import {PlatformIcon} from 'platformicons';

import {Link} from 'sentry/components/core/link';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {PlatformKey, Project} from 'sentry/types/project';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import useOrganization from 'sentry/utils/useOrganization';
import useProjects from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/newTraceDetails/traceAnalytics';
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

  const onProfileLinkClick = useCallback(
    (type: 'continuous' | 'transaction') => {
      if (type === 'continuous') {
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
        const profileId = node.profileId;
        const profilerId = node.profilerId;

        if (!profileId && !profilerId) {
          return null;
        }

        const query = node.transactionId
          ? {
              eventId: node.transactionId,
            }
          : {};

        const link = profilerId
          ? generateContinuousProfileFlamechartRouteWithQuery({
              organization,
              profilerId,
              start: new Date(node.space[0]).toISOString(),
              end: new Date(node.space[0] + node.space[1]).toISOString(),
              projectSlug: node.projectSlug ?? '',
              query,
            })
          : generateProfileFlamechartRouteWithQuery({
              organization,
              projectSlug: node.projectSlug ?? '',
              profileId: profileId!,
              query,
            });

        const profileOrProfilerId = profilerId || profileId;

        const event = (
          <Fragment>
            {node.projectSlug && (
              <PlatformIcon platform={projectLookup[node.projectSlug] ?? 'default'} />
            )}
            <span>{node.op ?? '<unknown>'}</span> —{' '}
            <span className="TraceDescription" title={node.description}>
              {node.description
                ? ellipsize(node.description, 100)
                : (node.id ?? 'unknown')}
            </span>
          </Fragment>
        );
        return (
          <ProfilesTableRow key={index}>
            <div>{event}</div>
            <div>
              <Link
                to={link}
                onClick={() =>
                  onProfileLinkClick(profilerId ? 'continuous' : 'transaction')
                }
              >
                {profileOrProfilerId!.substring(0, 8)}
              </Link>
            </div>
          </ProfilesTableRow>
        );
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
