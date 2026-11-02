import type {ComponentProps} from 'react';
import {IconOpen} from '@sentry/icons/open';
import {useQueryClient} from '@tanstack/react-query';

import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link';
import {Switch} from '@sentry/scraps/switch';
import {Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {getRepoStatusLabel} from 'sentry/components/repositories/getRepoStatusLabel';
import {useBulkUpdateRepositorySettings} from 'sentry/components/repositories/useBulkUpdateRepositorySettings';
import {getRepositoryWithSettingsQueryKey} from 'sentry/components/repositories/useRepositoryWithSettings';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import {
  DEFAULT_CODE_REVIEW_TRIGGERS,
  RepositoryStatus,
  type RepositoryWithSettings,
} from 'sentry/types/integrations';
import type {CodeReviewTrigger} from 'sentry/types/seer';
import {ListItemSelectCheckbox} from 'sentry/utils/list/listItemSelectCheckbox';
import {setApiQueryData} from 'sentry/utils/queryClient';
import {useCanWriteSettings} from 'sentry/utils/seer/useCanWriteSettings';
import {useLocation} from 'sentry/utils/useLocation';
import {useOrganization} from 'sentry/utils/useOrganization';

interface Props extends Omit<ComponentProps<typeof SimpleTable.Row>, 'children'> {
  mutateRepositorySettings: ReturnType<typeof useBulkUpdateRepositorySettings>['mutate'];
  repository: RepositoryWithSettings;
}

export function SeerRepoTableRow({
  mutateRepositorySettings,
  repository,
  ...rowProps
}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const location = useLocation();
  const canWrite = useCanWriteSettings();

  return (
    <SimpleTable.Row {...rowProps}>
      <SimpleTable.RowCell>
        <ListItemSelectCheckbox
          htmlPrefix="seer-repo-table-select"
          value={repository.id}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Stack gap="xs">
          <Link
            to={{
              pathname: `/settings/${organization.slug}/seer/repos/${repository.id}/`,
              query: location.query,
            }}
          >
            <Flex align="center">
              <strong>{repository.name}</strong>
              {repository.status !== RepositoryStatus.ACTIVE && (
                <small> &mdash; {getRepoStatusLabel(repository)}</small>
              )}
            </Flex>
          </Link>
          <Flex align="center">
            {<small>{repository.provider.name}</small>}
            {repository.url && <span>&nbsp;&mdash;&nbsp;</span>}
            {repository.url && (
              <ExternalLink href={repository.url}>
                <Flex align="center" gap="xs">
                  <small>{repository.url.replace('https://', '')}</small>
                  <IconOpen size="xs" />
                </Flex>
              </ExternalLink>
            )}
          </Flex>
        </Stack>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Switch
          disabled={!canWrite}
          checked={repository.settings?.enabledCodeReview ?? false}
          onChange={e => {
            const queryKey = getRepositoryWithSettingsQueryKey(
              organization,
              repository.id
            );
            const optimisticData = {
              ...repository,
              settings: {
                codeReviewTriggers: DEFAULT_CODE_REVIEW_TRIGGERS,
                ...repository.settings,
                enabledCodeReview: e.target.checked,
              },
            };
            setApiQueryData<RepositoryWithSettings>(
              queryClient,
              getRepositoryWithSettingsQueryKey(organization, repository.id),
              optimisticData
            );
            addLoadingMessage(t('Updating code review for %s', repository.name));
            mutateRepositorySettings(
              {
                codeReviewTriggers:
                  repository.settings?.codeReviewTriggers || DEFAULT_CODE_REVIEW_TRIGGERS,
                enabledCodeReview: e.target.checked,
                repositoryIds: [repository.id],
              },
              {
                onError: () => {
                  setApiQueryData<RepositoryWithSettings>(
                    queryClient,
                    queryKey,
                    repository
                  );
                  addErrorMessage(
                    t('Failed to update code review for %s', repository.name)
                  );
                },
                onSuccess: () => {
                  addSuccessMessage(t('Code review updated for %s', repository.name));
                },
                onSettled: () => {
                  queryClient.invalidateQueries({queryKey});
                },
              }
            );
          }}
        />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Text size="sm">
          {repository.settings?.codeReviewTriggers
            .toSorted()
            .map(triggerToLabel)
            .map((label, index, array) => (
              <div key={label}>
                {label}
                {index === array.length - 1 ? '' : ', '}
              </div>
            ))}
        </Text>
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

function triggerToLabel(trigger: CodeReviewTrigger) {
  switch (trigger) {
    case 'on_new_commit':
      return t('On New Commit');
    case 'on_ready_for_review':
      return t('On Ready for Review');
    default:
      return trigger;
  }
}
