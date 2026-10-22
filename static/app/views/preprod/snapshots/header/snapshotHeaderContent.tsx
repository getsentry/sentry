import {IconEllipsis} from '@sentry/icons/ellipsis';

import type {BreadcrumbTitleItem} from '@sentry/scraps/breadcrumbList';

import {ConfirmDelete} from 'sentry/components/confirmDelete';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {Placeholder} from 'sentry/components/placeholder';
import {t} from 'sentry/locale';
import type {getApiUrl} from 'sentry/utils/api/getApiUrl';
import {useOrganization} from 'sentry/utils/useOrganization';
import {useProjectFromId} from 'sentry/utils/useProjectFromId';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';
import {TopBar} from 'sentry/views/navigation/topBar';
import {SnapshotApproveButton} from 'sentry/views/preprod/snapshots/header/snapshotApproveButton';
import {useSnapshotActions} from 'sentry/views/preprod/snapshots/header/useSnapshotActions';
import type {SnapshotDetailsApiResponse} from 'sentry/views/preprod/types/snapshotTypes';

type PageTitleItem = Extract<BreadcrumbTitleItem, {type: 'page-title'}>;

interface SnapshotBreadcrumbsProps {
  snapshotId: string;
  projectId?: string;
  trailingActions?: PageTitleItem['trailingActions'];
}

function SnapshotBreadcrumbs({
  projectId,
  snapshotId,
  trailingActions,
}: SnapshotBreadcrumbsProps) {
  const organization = useOrganization();
  const project = useProjectFromId({project_id: projectId});

  return (
    <TopBar.Slot
      name="breadcrumbs"
      items={[
        {
          type: 'link',
          label: t('Snapshots'),
          to: {
            pathname: makeReleasesPathname({path: '/', organization}),
            query: {tab: 'snapshots', project: project?.id},
          },
        },
      ]}
      title={{
        type: 'page-title',
        label: snapshotId,
        leadingGraphic: project ? (
          <ProjectBadge
            disableLink
            hideName
            project={project}
            avatarSize={16}
            avatarProps={{hasTooltip: true, tooltip: project.slug}}
          />
        ) : (
          <Placeholder width="16px" height="16px" />
        ),
        trailingActions,
      }}
    />
  );
}

interface SnapshotHeaderContentProps {
  apiUrl: ReturnType<typeof getApiUrl>;
  organizationSlug: string;
  snapshotId: string;
  data?: SnapshotDetailsApiResponse;
}

function SnapshotBreadcrumbsWithActions({
  apiUrl,
  data,
  organizationSlug,
  snapshotId,
}: SnapshotHeaderContentProps & {data: SnapshotDetailsApiResponse}) {
  const actions = useSnapshotActions({apiUrl, data, organizationSlug});

  return (
    <ConfirmDelete {...actions.confirmDeleteProps}>
      {({open}) => (
        <SnapshotBreadcrumbs
          snapshotId={snapshotId}
          projectId={data.project_id}
          trailingActions={[
            {
              type: 'menu',
              triggerLabel: t('More actions'),
              triggerIcon: <IconEllipsis />,
              items: actions.buildMenuItems(open),
            },
            actions.canApprove
              ? {
                  type: 'button',
                  element: (
                    <SnapshotApproveButton
                      onApprove={actions.onApprove}
                      disabled={actions.isApproving}
                    />
                  ),
                }
              : null,
          ]}
        />
      )}
    </ConfirmDelete>
  );
}

/**
 * The snapshot id is the artifact id and comes straight from the route, so the
 * page title is there before the request resolves. The actions are not — they
 * need the response — so they arrive with it.
 */
export function SnapshotHeaderContent(props: SnapshotHeaderContentProps) {
  if (!props.data) {
    return <SnapshotBreadcrumbs snapshotId={props.snapshotId} />;
  }

  return <SnapshotBreadcrumbsWithActions {...props} data={props.data} />;
}
