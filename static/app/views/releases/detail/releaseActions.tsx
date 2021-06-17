import * as React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import {archiveRelease, restoreRelease} from 'app/actionCreators/release';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import MenuItem from 'app/components/menuItem';
import NavigationButtonGroup from 'app/components/navigationButtonGroup';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import space from 'app/styles/space';
import {Organization, Release, ReleaseMeta} from 'app/types';
import {trackAnalyticsEvent} from 'app/utils/analytics';
import {formatVersion} from 'app/utils/formatters';

import {isReleaseArchived} from '../utils';

type Props = {
  location: Location;
  organization: Organization;
  projectSlug: string;
  release: Release;
  releaseMeta: ReleaseMeta;
  refetchData: () => void;
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
      browserHistory.push(`/organizations/${organization.slug}/releases/`);
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
      <React.Fragment>
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
      </React.Fragment>
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
      <React.Fragment>
        {message}

        <ProjectsWrapper>{getProjectList()}</ProjectsWrapper>

        {t('Are you sure you want to do this?')}
      </React.Fragment>
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
    trackAnalyticsEvent({
      eventKey: `release_detail.pagination`,
      eventName: `Release Detail: Pagination`,
      organization_id: parseInt(organization.id, 10),
      direction,
    });
  }

  const {
    nextReleaseVersion,
    prevReleaseVersion,
    firstReleaseVersion,
    lastReleaseVersion,
  } = release.currentProjectMeta;

  return (
    <ButtonBar gap={1}>
      <NavigationButtonGroup
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
      <StyledDropdownLink
        caret={false}
        anchorRight={window.innerWidth > 992}
        title={<ActionsButton icon={<IconEllipsis />} label={t('Actions')} />}
      >
        {isReleaseArchived(release) ? (
          <Confirm
            onConfirm={handleRestore}
            header={getModalHeader(
              tct('Restore Release [release]', {
                release: formatVersion(release.version),
              })
            )}
            message={getModalMessage(
              tn(
                'You are restoring this release for the following project:',
                'By restoring this release, you are also restoring it for the following projects:',
                releaseMeta.projects.length
              )
            )}
            cancelText={t('Nevermind')}
            confirmText={t('Restore')}
          >
            <MenuItem>{t('Restore')}</MenuItem>
          </Confirm>
        ) : (
          <Confirm
            onConfirm={handleArchive}
            header={getModalHeader(
              tct('Archive Release [release]', {
                release: formatVersion(release.version),
              })
            )}
            message={getModalMessage(
              tn(
                'You are archiving this release for the following project:',
                'By archiving this release, you are also archiving it for the following projects:',
                releaseMeta.projects.length
              )
            )}
            cancelText={t('Nevermind')}
            confirmText={t('Archive')}
          >
            <MenuItem>{t('Archive')}</MenuItem>
          </Confirm>
        )}
      </StyledDropdownLink>
    </ButtonBar>
  );
}

const ActionsButton = styled(Button)`
  width: 40px;
  height: 40px;
  padding: 0;
`;

const StyledDropdownLink = styled(DropdownLink)`
  & + .dropdown-menu {
    top: 50px !important;
  }
`;

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
