import {Fragment} from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {archiveRelease, restoreRelease} from 'sentry/actionCreators/release';
import {Client} from 'sentry/api';
import ButtonBar from 'sentry/components/buttonBar';
import {openConfirmModal} from 'sentry/components/confirm';
import {DropdownMenu} from 'sentry/components/dropdownMenu';
import ProjectBadge from 'sentry/components/idBadge/projectBadge';
import NavigationButtonGroup from 'sentry/components/navigationButtonGroup';
import TextOverflow from 'sentry/components/textOverflow';
import {Tooltip} from 'sentry/components/tooltip';
import {IconEllipsis} from 'sentry/icons';
import {t, tct, tn} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {Organization, Release, ReleaseMeta} from 'sentry/types';
import {trackAnalytics} from 'sentry/utils/analytics';
import {formatVersion} from 'sentry/utils/formatters';
import {normalizeUrl} from 'sentry/utils/withDomainRequired';

import {isReleaseArchived} from '../../utils';

type Props = {
  location: Location;
  organization: Organization;
  projectSlug: string;
  refetchData: () => void;
  release: Release;
  releaseMeta: ReleaseMeta;
};

function ReleaseActions({
  location,
  organization,
  projectSlug,
  release,
  releaseMeta,
  refetchData,
}: Props) {
  async function handleArchive() {
    try {
      await archiveRelease(new Client(), {
        orgSlug: organization.slug,
        projectSlug,
        releaseVersion: release.version,
      });
      browserHistory.push(normalizeUrl(`/organizations/${organization.slug}/releases/`));
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
          <span>
            <Tooltip
              title={release.projects
                .slice(maxVisibleProjects)
                .map(p => p.slug)
                .join(', ')}
            >
              + {tn('%s other project', '%s other projects', numberOfCollapsedProjects)}
            </Tooltip>
          </span>
        )}
      </Fragment>
    );
  }

  function getModalHeader(title: React.ReactNode) {
    return (
      <h4>
        <TextOverflow>{title}</TextOverflow>
      </h4>
    );
  }

  function getModalMessage(message: React.ReactNode) {
    return (
      <Fragment>
        {message}

        <ProjectsWrapper>{getProjectList()}</ProjectsWrapper>

        {t('Are you sure you want to do this?')}
      </Fragment>
    );
  }

  function replaceReleaseUrl(toRelease: string | null) {
    return toRelease
      ? {
          pathname: location.pathname
            .replace(encodeURIComponent(release.version), toRelease)
            .replace(release.version, toRelease),
          query: {...location.query, activeRepo: undefined},
        }
      : '';
  }

  function handleNavigationClick(direction: string) {
    trackAnalytics(`release_detail.pagination`, {
      organization,
      direction,
    });
  }

  const menuItems = [
    isReleaseArchived(release)
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
        },
  ];

  const {
    nextReleaseVersion,
    prevReleaseVersion,
    firstReleaseVersion,
    lastReleaseVersion,
  } = release.currentProjectMeta;

  return (
    <ButtonBar gap={1}>
      <NavigationButtonGroup
        size="sm"
        hasPrevious={!!prevReleaseVersion}
        hasNext={!!nextReleaseVersion}
        links={[
          replaceReleaseUrl(firstReleaseVersion),
          replaceReleaseUrl(prevReleaseVersion),
          replaceReleaseUrl(nextReleaseVersion),
          replaceReleaseUrl(lastReleaseVersion),
        ]}
        onOldestClick={() => handleNavigationClick('oldest')}
        onOlderClick={() => handleNavigationClick('older')}
        onNewerClick={() => handleNavigationClick('newer')}
        onNewestClick={() => handleNavigationClick('newest')}
      />
      <DropdownMenu
        size="sm"
        items={menuItems}
        triggerProps={{
          showChevron: false,
          icon: <IconEllipsis />,
          'aria-label': t('Actions'),
        }}
        position="bottom-end"
      />
    </ButtonBar>
  );
}

const ProjectsWrapper = styled('div')`
  margin: ${space(2)} 0 ${space(2)} ${space(2)};
  display: grid;
  gap: ${space(0.5)};
  img {
    border: none !important;
    box-shadow: none !important;
  }
`;

export default ReleaseActions;
