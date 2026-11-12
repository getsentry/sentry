import {useMemo} from 'react';
import {PlatformIcon} from 'platformicons';

import {Link} from '@sentry/scraps/link';
import type {TableColumnConfig} from '@sentry/scraps/table';
import {Text} from '@sentry/scraps/text';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {Project} from 'sentry/types/project';
import {
  generateContinuousProfileFlamechartRouteWithQuery,
  generateProfileFlamechartRouteWithQuery,
} from 'sentry/utils/profiling/routes';
import {ellipsize} from 'sentry/utils/string/ellipsize';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjects} from 'sentry/utils/useProjects';
import {traceAnalytics} from 'sentry/views/performance/traceDetails/traceAnalytics';
import {TraceTree} from 'sentry/views/performance/traceDetails/traceModels/traceTree';
import type {BaseNode} from 'sentry/views/performance/traceDetails/traceModels/traceTreeNode/baseNode';

const COLUMNS: TableColumnConfig[] = [
  {key: 'event', width: 'minmax(0, 1fr)'},
  {key: 'profile', width: 'min-content'},
];

export function TraceProfiles({tree}: {tree: TraceTree}) {
  const {projects} = useProjects();
  const organization = useOrganization();

  const projectLookup = useMemo(() => {
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

  const onProfileLinkClick = (type: 'continuous' | 'transaction') => {
    if (type === 'continuous') {
      traceAnalytics.trackViewContinuousProfile(organization);
    } else {
      traceAnalytics.trackViewTransactionProfile(organization);
    }
  };

  return (
    <SimpleTable
      aria-label={t('Profiled Events')}
      columns={COLUMNS}
      header={
        <SimpleTable.HeaderRow>
          <SimpleTable.HeaderCell>{t('Profiled Events')}</SimpleTable.HeaderCell>
          <SimpleTable.HeaderCell>{t('Profile')}</SimpleTable.HeaderCell>
        </SimpleTable.HeaderRow>
      }
    >
      {profiles.map((node, index) => {
        const profileId = node.profileId;
        const profilerId = node.profilerId;

        if (!profileId && !profilerId) {
          return null;
        }

        const query = getProfileRouteQueryFromNode(node);

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

        return (
          <SimpleTable.Row key={index}>
            <SimpleTable.RowCell gap="xs">
              {node.projectSlug && (
                <PlatformIcon
                  platform={projectLookup[node.projectSlug] ?? 'default'}
                  size={16}
                />
              )}
              <Text ellipsis>
                {node.op ?? '<unknown>'} —{' '}
                <span title={node.description}>
                  {node.description
                    ? ellipsize(node.description, 100)
                    : (node.id ?? 'unknown')}
                </span>
              </Text>
            </SimpleTable.RowCell>
            <SimpleTable.RowCell>
              <Link
                to={link}
                onClick={() =>
                  onProfileLinkClick(profilerId ? 'continuous' : 'transaction')
                }
              >
                {profileOrProfilerId!.substring(0, 8)}
              </Link>
            </SimpleTable.RowCell>
          </SimpleTable.Row>
        );
      })}
    </SimpleTable>
  );
}

function getProfileRouteQueryFromNode(node: BaseNode) {
  const threadId = node.attributes?.['thread.id'] ?? undefined;
  return {
    eventId: node.transactionId,
    tid: typeof threadId === 'string' ? threadId : undefined,
  };
}
