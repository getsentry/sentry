import React from 'react';
import styled from '@emotion/styled';

import {Client} from 'app/api';
import {Repository, RepositoryProjectPathConfig, Project} from 'app/types';
import {t} from 'app/locale';
import Access from 'app/components/acl/access';
import Button from 'app/components/button';
import Confirm from 'app/components/confirm';
import {IconDelete, IconEdit} from 'app/icons';
import QuestionTooltip from 'app/components/questionTooltip';
import space from 'app/styles/space';
import Tooltip from 'app/components/tooltip';
import IdBadge from 'app/components/idBadge';

type Props = {
  pathConfig: RepositoryProjectPathConfig;
  repo: Repository; //TODO: remove
  project: Project;
};

export default class RepositoryProjectPathConfigRow extends React.Component<Props> {
  api = new Client();

  deleteProjectPathConfig = () => {
    //TODO: Finish
  };

  render() {
    // TODO: Improve UI
    const {pathConfig, project} = this.props;

    return (
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
          <React.Fragment>
            <NameRepoColumn>
              <ProjectRepoHolder>
                <RepoName>
                  {pathConfig.repoName}
                  <StyledQuestionTooltip
                    size="xs"
                    position="top"
                    title={t('TO BE FILLED IN LATER')}
                  />
                </RepoName>
                <StyledIdBadge
                  project={project}
                  avatarSize={14}
                  displayName={project.slug}
                  avatarProps={{consistentWidth: true}}
                />
              </ProjectRepoHolder>
            </NameRepoColumn>
            <OutputPathColumn>{pathConfig.sourceRoot}</OutputPathColumn>
            <InputPathColumn>{pathConfig.stackRoot}</InputPathColumn>
            <DefaultBranchColumn>{pathConfig.defaultBranch}</DefaultBranchColumn>
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
                />
                <Confirm
                  disabled={!hasAccess}
                  onConfirm={this.deleteProjectPathConfig}
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

const StyledIdBadge = styled(IdBadge)`
  color: ${p => p.theme.gray500};
`;

const StyledQuestionTooltip = styled(QuestionTooltip)`
  padding: ${space(0.5)};
`;

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

export const DefaultBranchColumn = styled(Column)`
  grid-area: default-branch;
`;

export const ButtonColumn = styled(Column)`
  grid-area: button;
  text-align: right;
`;
