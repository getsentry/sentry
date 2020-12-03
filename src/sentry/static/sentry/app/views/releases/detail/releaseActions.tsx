import React from 'react';
import {browserHistory} from 'react-router';
import styled from '@emotion/styled';
import PropTypes from 'prop-types';

import {archiveRelease, restoreRelease} from 'app/actionCreators/release';
import {Client} from 'app/api';
import Button from 'app/components/button';
import ButtonBar from 'app/components/buttonBar';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import MenuItem from 'app/components/menuItem';
import TextOverflow from 'app/components/textOverflow';
import Tooltip from 'app/components/tooltip';
import {IconEllipsis} from 'app/icons';
import {t, tct, tn} from 'app/locale';
import SentryTypes from 'app/sentryTypes';
import space from 'app/styles/space';
import {Release, ReleaseMeta} from 'app/types';
import {formatVersion} from 'app/utils/formatters';

import {isReleaseArchived} from '../utils';

type Props = {
  orgSlug: string;
  projectSlug: string;
  release: Release;
  releaseMeta: ReleaseMeta;
  refetchData: () => void;
};

function ReleaseActions({
  orgSlug,
  projectSlug,
  release,
  releaseMeta,
  refetchData,
}: Props) {
  async function handleArchive() {
    try {
      await archiveRelease(new Client(), {
        orgSlug,
        projectSlug,
        releaseVersion: release.version,
      });
      browserHistory.push(`/organizations/${orgSlug}/releases/`);
    } catch {
      // do nothing, action creator is already displaying error message
    }
  }

  async function handleRestore() {
    try {
      await restoreRelease(new Client(), {
        orgSlug,
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

  return (
    <ButtonBar gap={1}>
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

ReleaseActions.propTypes = {
  orgSlug: PropTypes.string.isRequired,
  projectSlug: PropTypes.string.isRequired,
  release: SentryTypes.Release.isRequired,
  releaseMeta: PropTypes.object.isRequired,
  refetchData: PropTypes.func.isRequired,
};

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
