/* eslint-disable react/prop-types */
import React from 'react';
import styled from '@emotion/styled';

import {t, tct, tn} from 'app/locale';
import {Release} from 'app/types';
import space from 'app/styles/space';
import Button from 'app/components/button';
import {IconEllipsis} from 'app/icons';
import Confirm from 'app/components/confirm';
import DropdownLink from 'app/components/dropdownLink';
import MenuItem from 'app/components/menuItem';
import ProjectBadge from 'app/components/idBadge/projectBadge';
import {formatVersion} from 'app/utils/formatters';
import Tooltip from 'app/components/tooltip';
import TextOverflow from 'app/components/textOverflow';

import {archiveRelease, restoreRelease} from './utils';
import {isReleaseArchived} from '../utils';

type Props = {
  orgId: string;
  release: Release;
  refetchData: () => void;
};

function ReleaseActions({orgId, release, refetchData}: Props) {
  function handleArchive() {
    archiveRelease(orgId, release.version);
  }

  function handleRestore() {
    restoreRelease(orgId, release.version, refetchData);
  }

  function getProjectList() {
    const maxVisibleProjects = 5;
    const visibleProjects = release.projects.slice(0, maxVisibleProjects);
    const numberOfCollapsedProjects = release.projects.length - visibleProjects.length;

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

  function getArchiveModalMessage() {
    return (
      <div>
        {tn(
          'You are archiving this release for the following project:',
          'By archiving this release, you are also archiving it for the following projects:',
          release.projects.length
        )}

        <ProjectsWrapper>{getProjectList()}</ProjectsWrapper>

        {t('Are you sure you want to do this?')}
      </div>
    );
  }

  function getRestoreModalMessage() {
    return (
      <div>
        {tn(
          'You are restoring this release for the following project:',
          'By restoring this release, you are also restoring it for the following projects:',
          release.projects.length
        )}

        <ProjectsWrapper>{getProjectList()}</ProjectsWrapper>

        {t('Are you sure you want to do this?')}
      </div>
    );
  }

  return (
    <Wrapper>
      <StyledDropdownLink
        caret={false}
        anchorRight
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
            message={getRestoreModalMessage()}
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
            message={getArchiveModalMessage()}
            cancelText={t('Nevermind')}
            confirmText={t('Archive')}
          >
            <MenuItem>{t('Archive')}</MenuItem>
          </Confirm>
        )}
      </StyledDropdownLink>
    </Wrapper>
  );
}

const Wrapper = styled('div')`
  display: grid;
  grid-auto-flow: column;
  grid-auto-columns: min-content;
  grid-gap: ${space(0.5)};

  @media (max-width: ${p => p.theme.breakpoints[0]}) {
    width: 100%;
    margin: ${space(1)} 0 ${space(2)} 0;
  }
`;

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
`;

export default ReleaseActions;
