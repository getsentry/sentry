import {IconDelete} from '@sentry/icons/delete';
import {IconEdit} from '@sentry/icons/edit';

import {Button} from '@sentry/scraps/button';
import {Flex} from '@sentry/scraps/layout';
import {Text} from '@sentry/scraps/text';
import {Tooltip} from '@sentry/scraps/tooltip';

import {Access} from 'sentry/components/acl/access';
import {Confirm} from 'sentry/components/confirm';
import {IdBadge} from 'sentry/components/idBadge';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {RepositoryProjectPathConfig} from 'sentry/types/integrations';
import type {Project} from 'sentry/types/project';

type Props = {
  onDelete: (pathConfig: RepositoryProjectPathConfig) => void;
  onEdit: (pathConfig: RepositoryProjectPathConfig) => void;
  pathConfig: RepositoryProjectPathConfig;
  project: Project;
};

export function RepositoryProjectPathConfigRow({
  pathConfig,
  project,
  onEdit,
  onDelete,
}: Props) {
  return (
    <SimpleTable.Row>
      <SimpleTable.RowCell direction="column" align="start" gap="md">
        <Text wordBreak="break-word">{pathConfig.repoName}</Text>
        <Flex align="center">
          <IdBadge
            project={project}
            avatarSize={14}
            displayName={project.slug}
            avatarProps={{consistentWidth: true}}
          />
          <Text variant="muted" wordBreak="break-word">
            &nbsp;|&nbsp;{pathConfig.defaultBranch}
          </Text>
        </Flex>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text wordBreak="break-word">{pathConfig.stackRoot}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Text wordBreak="break-word">{pathConfig.sourceRoot}</Text>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end" gap="md">
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
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}
