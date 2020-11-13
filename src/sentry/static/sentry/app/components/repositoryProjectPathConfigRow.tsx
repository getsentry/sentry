import React from 'react';
import styled from '@emotion/styled';

import {RepositoryProjectPathConfig, Project} from 'app/types';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete, IconEdit} from 'app/icons';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import IdBadge from 'app/components/idBadge';

type Props = {
  pathConfig: RepositoryProjectPathConfig;
  project: Project;
  onEdit: (pathConfig: RepositoryProjectPathConfig) => void;
  onDelete: (pathConfig: RepositoryProjectPathConfig) => void;
};

export default class RepositoryProjectPathConfigRow extends React.Component<Props> {
  render() {
    const {pathConfig, project, onEdit, onDelete} = this.props;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <React.Fragment>
            <NameRepoColumn>
              <ProjectRepoHolder>
                <RepoName>{pathConfig.repoName}</RepoName>
                <ProjectAndBranch>
                  <IdBadge
                    project={project}
                    avatarSize={14}
                    displayName={project.slug}
                    avatarProps={{consistentWidth: true}}
                  />
                  <BranchWrapper>&nbsp;|&nbsp;{pathConfig.defaultBranch}</BranchWrapper>
                </ProjectAndBranch>
              </ProjectRepoHolder>
            </NameRepoColumn>
            <OutputPathColumn>{pathConfig.sourceRoot}</OutputPathColumn>
            <InputPathColumn>{pathConfig.stackRoot}</InputPathColumn>
            <ButtonColumn>
              <Tooltip
                title={t(
                  'You must be an organization owner, manager or admin to edit or remove a code mapping.'
                )}
                disabled={hasAccess}
              >
                <StyledButton
                  size="small"
                  icon={<IconEdit size="sm" />}
                  label={t('edit')}
                  disabled={!hasAccess}
                  onClick={() => onEdit(pathConfig)}
                />
                <Confirm
                  disabled={!hasAccess}
                  onConfirm={() => onDelete(pathConfig)}
                  message={t('Are you sure you want to remove this code mapping?')}
                >
                  <StyledButton
                    size="small"
                    icon={<IconDelete size="sm" />}
                    label={t('delete')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            </ButtonColumn>
          </React.Fragment>
        )}
      </Access>
    );
  }
}

const ProjectRepoHolder = styled('div')`
  display: flex;
  flex-direction: column;
`;

const RepoName = styled(`span`)`
  padding-bottom: ${space(1)};
`;

const StyledButton = styled(Button)`
  margin: ${space(0.5)};
`;

const ProjectAndBranch = styled('div')`
  display: flex;
  flex-direction: row;
  color: ${p => p.theme.gray300};
`;

//match the line eight of the badge
const BranchWrapper = styled('div')`
  line-height: 1.2;
`;

//Columns below
const Column = styled('span')`
  overflow: hidden;
  overflow-wrap: break-word;
`;

export const NameRepoColumn = styled(Column)`
  grid-area: name-repo;
`;

export const OutputPathColumn = styled(Column)`
  grid-area: output-path;
`;

export const InputPathColumn = styled(Column)`
  grid-area: input-path;
`;

export const ButtonColumn = styled(Column)`
  grid-area: button;
  text-align: right;
`;
