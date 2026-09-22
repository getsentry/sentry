import {Fragment} from 'react';

import type {MenuItemProps} from '@sentry/scraps/dropdownMenu';
import {InfoText} from '@sentry/scraps/info';
import {Grid} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {archiveRelease, restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import {openConfirmModal} from 'sentry/components/confirm';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import {t, tct, tn} from 'sentry/locale';
import type {Organization} from 'sentry/types/organization';
import type {Release, ReleaseMeta, ReleaseProject} from 'sentry/types/release';
import {useCopyToClipboard} from 'sentry/utils/useCopyToClipboard';
import {useNavigate} from 'sentry/utils/useNavigate';
import {formatVersion} from 'sentry/utils/versions/formatVersion';
import {isReleaseArchived} from 'sentry/views/explore/releases/utils';
import {makeReleasesPathname} from 'sentry/views/explore/releases/utils/pathnames';

const MAX_VISIBLE_PROJECTS = 5;

/**
 * The projects an archive or restore will apply to, collapsing the tail into a
 * single entry once there are more than `MAX_VISIBLE_PROJECTS`.
 */
function ProjectList({projects}: {projects: ReleaseProject[]}) {
  const visibleProjects = projects.slice(0, MAX_VISIBLE_PROJECTS);
  const collapsedProjects = projects.slice(MAX_VISIBLE_PROJECTS);

  // justifyItems keeps each row sized to its content. Grid items are
  // blockified, so a stretched row would anchor the InfoText tooltip to the
  // full width of the modal rather than to the text itself.
  return (
    <Grid gap="xs" padding="xl 0 xl xl" justifyItems="start">
      {visibleProjects.map(project => (
        <ProjectBadge key={project.slug} project={project} avatarSize={18} />
      ))}
      {collapsedProjects.length > 0 && (
        <InfoText title={collapsedProjects.map(p => p.slug).join(', ')}>
          + {tn('%s other project', '%s other projects', collapsedProjects.length)}
        </InfoText>
      )}
    </Grid>
  );
}

function ModalHeader({children}: {children: React.ReactNode}) {
  return (
    <Heading as="h4" ellipsis>
      {children}
    </Heading>
  );
}

function ModalMessage({
  children,
  projects,
}: {
  children: React.ReactNode;
  projects: ReleaseProject[];
}) {
  return (
    <Fragment>
      {children}
      <ProjectList projects={projects} />
      {t('Are you sure you want to do this?')}
    </Fragment>
  );
}

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

  const statusItem: MenuItemProps = isReleaseArchived(release)
    ? {
        key: 'restore',
        label: t('Restore'),
        onAction: () =>
          openConfirmModal({
            onConfirm: handleRestore,
            header: (
              <ModalHeader>
                {tct('Restore Release [release]', {
                  release: formatVersion(release.version),
                })}
              </ModalHeader>
            ),
            message: (
              <ModalMessage projects={releaseMeta.projects}>
                {tn(
                  'You are restoring this release for the following project:',
                  'By restoring this release, you are also restoring it for the following projects:',
                  releaseMeta.projects.length
                )}
              </ModalMessage>
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
            header: (
              <ModalHeader>
                {tct('Archive Release [release]', {
                  release: formatVersion(release.version),
                })}
              </ModalHeader>
            ),
            message: (
              <ModalMessage projects={releaseMeta.projects}>
                {tn(
                  'You are archiving this release for the following project:',
                  'By archiving this release, you are also archiving it for the following projects:',
                  releaseMeta.projects.length
                )}
              </ModalMessage>
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
