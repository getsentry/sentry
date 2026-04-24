import {Flex} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link';
import {Text} from '@sentry/scraps/text';

import {IdBadge} from 'sentry/components/idBadge';
import * as Layout from 'sentry/components/layouts/thirds';
import {IconCode, IconCommit, IconPullRequest, IconStack} from 'sentry/icons';
import type {SVGIconProps} from 'sentry/icons/svgIcon';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';

interface VcsItemConfig {
  icon: React.ComponentType<SVGIconProps>;
  key: string;
  label: string;
  href?: string | null;
  monospace?: boolean;
  requiresHref?: boolean;
}

interface SnapshotHeaderContentProps {
  data: SnapshotDetailsApiResponse;
}

export function SnapshotHeaderContent({data}: SnapshotHeaderContentProps) {
  const {vcs_info, app_id: appId} = data;
  const shortSha = vcs_info.head_sha?.slice(0, 7);
  const project = ProjectsStore.getById(data.project_id);

  const vcsItems: VcsItemConfig[] = [
    {
      key: 'sha',
      icon: IconCommit,
      label: shortSha ?? '',
      href: getShaUrl(vcs_info, vcs_info.head_sha),
      monospace: true,
      requiresHref: true,
    },
    {
      key: 'pr',
      icon: IconPullRequest,
      label: vcs_info.pr_number ? `#${vcs_info.pr_number}` : '',
      href: getPrUrl(vcs_info),
      requiresHref: true,
    },
    {
      key: 'branch',
      icon: IconStack,
      label: vcs_info.head_ref ?? '',
      href: getBranchUrl(vcs_info, vcs_info.head_ref),
    },
  ].filter(item => item.label && (!item.requiresHref || item.href));

  return (
    <Layout.HeaderContent unified>
      <Layout.Title>
        <Flex align="center" gap="lg" wrap="wrap" minHeight="1lh">
          <Text size="lg" bold>
            {t('Snapshot')}
          </Text>

          {project && <IdBadge project={project} avatarSize={16} />}

          {vcsItems.map(item => (
            <Flex align="center" gap="xs" key={item.key}>
              <item.icon size="xs" />
              {item.href ? (
                <ExternalLink href={item.href}>
                  <Text size="sm" variant="accent" monospace={item.monospace}>
                    {item.label}
                  </Text>
                </ExternalLink>
              ) : (
                <Text size="sm">{item.label}</Text>
              )}
            </Flex>
          ))}

          {appId && (
            <Flex align="center" gap="xs">
              <IconCode size="xs" />
              <Text size="sm" variant="muted" monospace>
                {appId}
              </Text>
            </Flex>
          )}
        </Flex>
      </Layout.Title>
    </Layout.HeaderContent>
  );
}
