import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import IdBadge from 'sentry/components/idBadge';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Project, RepositoryProjectPathConfig} from 'sentry/types';

type Props = {
  onDelete: (pathConfig: RepositoryProjectPathConfig) => void;
  onEdit: (pathConfig: RepositoryProjectPathConfig) => void;
  pathConfig: RepositoryProjectPathConfig;
  project: Project;
};

export default class RepositoryProjectPathConfigRow extends Component<Props> {
  render() {
    const {pathConfig, project, onEdit, onDelete} = this.props;

    return (
      <Fragment>
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
          <StyledButton
            size="sm"
            icon={<IconEdit size="sm" />}
            aria-label={t('edit')}
            onClick={() => onEdit(pathConfig)}
          />
          <Confirm
            onConfirm={() => onDelete(pathConfig)}
            message={t('Are you sure you want to remove this code mapping?')}
          >
            <StyledButton
              size="sm"
              icon={<IconDelete size="sm" />}
              aria-label={t('delete')}
            />
          </Confirm>
        </ButtonColumn>
      </Fragment>
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

// match the line height of the badge
const BranchWrapper = styled('div')`
  line-height: 1.2;
`;

// Columns below
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
