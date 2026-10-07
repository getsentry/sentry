import {ProjectAvatar} from '@sentry/scraps/avatar';
import type {BreadcrumbListProps} from '@sentry/scraps/breadcrumbList';

import {DocumentationHint} from 'sentry/components/documentationHint';
import {IconCode, IconCommit, IconPullRequest, IconStack} from 'sentry/icons';
import {t} from 'sentry/locale';
import {ProjectsStore} from 'sentry/stores/projectsStore';
import {useOrganization} from 'sentry/utils/useOrganization';
import {TopBar} from 'sentry/views/navigation/topBar';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';
import {getBranchUrl, getPrUrl, getShaUrl} from 'sentry/views/preprod/utils/vcsLinkUtils';
import {makeProjectsPathname} from 'sentry/views/projects/pathname';

interface SnapshotHeaderContentProps {
  data: SnapshotDetailsApiResponse;
}

export function SnapshotHeaderContent({data}: SnapshotHeaderContentProps) {
  const organization = useOrganization();
  const {vcs_info, app_id: appId} = data;
  const shortSha = vcs_info.head_sha?.slice(0, 7);
  const project = ProjectsStore.getById(data.project_id);
  const shaUrl = getShaUrl(vcs_info, vcs_info.head_sha);
  const prUrl = getPrUrl(vcs_info);
  const branchUrl = getBranchUrl(vcs_info, vcs_info.head_ref);
  const items: BreadcrumbListProps['items'] = [];

  if (project) {
    items.push({
      type: 'link',
      label: project.slug,
      to: `${makeProjectsPathname({path: `/${project.slug}/`, organization})}?project=${project.id}`,
      leadingGraphic: <ProjectAvatar project={project} size={16} />,
    });
  }
  if (shortSha && shaUrl) {
    items.push({
      type: 'link',
      label: shortSha,
      externalHref: shaUrl,
      leadingGraphic: <IconCommit size="xs" />,
    });
  }
  if (vcs_info.pr_number && prUrl) {
    items.push({
      type: 'link',
      label: `#${vcs_info.pr_number}${vcs_info.head_ref ? ` (${vcs_info.head_ref})` : ''}`,
      externalHref: prUrl,
      leadingGraphic: <IconPullRequest size="xs" />,
    });
  } else if (vcs_info.head_ref && branchUrl) {
    items.push({
      type: 'link',
      label: vcs_info.head_ref,
      externalHref: branchUrl,
      leadingGraphic: <IconStack size="xs" />,
    });
  }
  if (appId) {
    items.push({
      type: 'link',
      label: appId,
      to: `/organizations/${organization.slug}/explore/releases/?query=${encodeURIComponent(`app_id:${appId}`)}&tab=snapshots`,
      leadingGraphic: <IconCode size="xs" />,
    });
  }

  return (
    <TopBar.Slot
      name="breadcrumbs"
      items={items}
      title={{
        type: 'page-title',
        label: t('Snapshots'),
        labelTooltip: (
          <DocumentationHint docsUrl="https://docs.sentry.io/product/snapshots/">
            {t('Catch visual regressions before they reach users.')}
          </DocumentationHint>
        ),
      }}
    />
  );
}
