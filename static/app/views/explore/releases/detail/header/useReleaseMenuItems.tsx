import {Fragment} from 'react';

import {Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {archiveRelease, restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import type {MenuItemProps} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseMeta} from 'sentry/types/release';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {isReleaseArchived} from 'sentry/views/explore/releases/utils';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

interface Props {
  organization: Organization;
  projectSlug: string;
  refetchData: () => void;
  release: Release;
  releaseMeta: ReleaseMeta;
}

/**
 * Items for the release detail page-title actions menu — copying the version,
 * plus archiving or restoring the release depending on its current status.
 */
export function useReleaseMenuItems({
  organization,
  projectSlug,
  refetchData,
  release,
  releaseMeta,
}: Props): MenuItemProps[] {
  const navigate = useNavigate();
  const {copy} = useCopyToClipboard();

  async function handleArchive() {
    try {
      await archiveRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version,
      });
      navigate(
        makeReleasesPathname({
          organization,
          path: '/',
        })
      );
    } catch {
      // do nothing, action creator is already displaying error message
    }
  }

  async function handleRestore() {
    try {
      await restoreRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version,
      });
      refetchData();
    } catch {
      // do nothing, action creator is already displaying error message
    }
  }

  function getProjectList() {
    const maxVisibleProjects = 5;
    const visibleProjects = releaseMeta.projects.slice(0, maxVisibleProjects);
    const numberOfCollapsedProjects =
      releaseMeta.projects.length - visibleProjects.length;

    return (
      <Fragment>
        {visibleProjects.map(project => (
          <ProjectBadge key={project.slug} project={project} avatarSize={18} />
        ))}
        {numberOfCollapsedProjects > 0 && (
          // Tooltip wraps non-element children in its own span, so it needs no
          // container of its own here.
          <Tooltip
            title={releaseMeta.projects
              .slice(maxVisibleProjects)
              .map(p => p.slug)
              .join(', ')}
          >
            + {tn('%s other project', '%s other projects', numberOfCollapsedProjects)}
          </Tooltip>
        )}
      </Fragment>
    );
  }

  function getModalHeader(title: React.ReactNode) {
    return (
      <Heading as="h4" ellipsis>
        {title}
      </Heading>
    );
  }

  function getModalMessage(message: React.ReactNode) {
    return (
      <Fragment>
        {message}
        <Grid gap="xs" padding="xl 0 xl xl">
          {getProjectList()}
        </Grid>
        {t('Are you sure you want to do this?')}
      </Fragment>
    );
  }

  const statusItem: MenuItemProps = isReleaseArchived(release)
    ? {
        key: 'restore',
        label: t('Restore'),
        onAction: () =>
          openConfirmModal({
            onConfirm: handleRestore,
            header: getModalHeader(
              tct('Restore Release [release]', {
                release: formatVersion(release.version),
              })
            ),
            message: getModalMessage(
              tn(
                'You are restoring this release for the following project:',
                'By restoring this release, you are also restoring it for the following projects:',
                releaseMeta.projects.length
              )
            ),
            cancelText: t('Nevermind'),
            confirmText: t('Restore'),
          }),
      }
    : {
        key: 'archive',
        label: t('Archive'),
        onAction: () =>
          openConfirmModal({
            onConfirm: handleArchive,
            header: getModalHeader(
              tct('Archive Release [release]', {
                release: formatVersion(release.version),
              })
            ),
            message: getModalMessage(
              tn(
                'You are archiving this release for the following project:',
                'By archiving this release, you are also archiving it for the following projects:',
                releaseMeta.projects.length
              )
            ),
            cancelText: t('Nevermind'),
            confirmText: t('Archive'),
          }),
      };

  return [
    {
      key: 'copy-version',
      label: t('Copy release version to clipboard'),
      onAction: () => copy(release.version),
    },
    statusItem,
  ];
}
