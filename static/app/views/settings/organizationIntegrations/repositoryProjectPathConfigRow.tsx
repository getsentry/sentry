import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Flex, Stack, type FlexProps} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {Tooltip} from 'sentry/components/core/tooltip';
import IdBadge from 'sentry/components/idBadge';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

type Props = {
  onDelete: (pathConfig: RepositoryProjectPathConfig) => void;
  onEdit: (pathConfig: RepositoryProjectPathConfig) => void;
  pathConfig: RepositoryProjectPathConfig;
  project: Project;
};

export default function RepositoryProjectPathConfigRow({
  pathConfig,
  project,
  onEdit,
  onDelete,
}: Props) {
  return (
    <Fragment>
      <NameRepoColumn>
        <Stack>
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
        </Stack>
      </NameRepoColumn>
      <OutputPathColumn>{pathConfig.sourceRoot}</OutputPathColumn>
      <InputPathColumn>{pathConfig.stackRoot}</InputPathColumn>
      <ButtonWrapper>
        <Button
          size="sm"
          icon={<IconEdit size="sm" />}
          aria-label={t('edit')}
          onClick={() => onEdit(pathConfig)}
        />
        <Access access={['org:integrations']}>
          {({hasAccess}) => (
            <Tooltip
              title={t(
                'You must be an organization owner, manager or admin to remove a code mapping.'
              )}
              disabled={hasAccess}
            >
              <Confirm
                onConfirm={() => onDelete(pathConfig)}
                message={t('Are you sure you want to remove this code mapping?')}
                disabled={!hasAccess}
              >
                <Button
                  size="sm"
                  icon={<IconDelete size="sm" />}
                  aria-label={t('delete')}
                  disabled={!hasAccess}
                />
              </Confirm>
            </Tooltip>
          )}
        </Access>
      </ButtonWrapper>
    </Fragment>
  );
}

const RepoName = styled(`span`)`
  padding-bottom: ${space(1)};
`;

const ProjectAndBranch = styled('div')`
  display: flex;
  flex-direction: row;
  color: ${p => p.theme.tokens.content.secondary};
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

export function ButtonWrapper(props: Omit<FlexProps<'span'>, 'as'>) {
  return <Flex {...props} as="span" gap="md" />;
}
