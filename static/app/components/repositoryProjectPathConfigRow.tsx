import {Component, Fragment} from 'react';
import styled from '@emotion/styled';

import Access from 'sentry/components/acl/access';
import Button from 'sentry/components/button';
import Confirm from 'sentry/components/confirm';
import IdBadge from 'sentry/components/idBadge';
import Tooltip from 'sentry/components/tooltip';
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
      <Access access={['org:integrations']}>
        {({hasAccess}) => (
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
              <Tooltip
                title={t(
                  'You must be an organization owner, manager or admin to edit or remove a code mapping.'
                )}
                disabled={hasAccess}
              >
                <StyledButton
                  size="sm"
                  icon={<IconEdit size="sm" />}
                  aria-label={t('edit')}
                  disabled={!hasAccess}
                  onClick={() => onEdit(pathConfig)}
                />
                <Confirm
                  disabled={!hasAccess}
                  onConfirm={() => onDelete(pathConfig)}
                  message={t('Are you sure you want to remove this code mapping?')}
                >
                  <StyledButton
                    size="sm"
                    icon={<IconDelete size="sm" />}
                    aria-label={t('delete')}
                    disabled={!hasAccess}
                  />
                </Confirm>
              </Tooltip>
            </ButtonColumn>
          </Fragment>
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
