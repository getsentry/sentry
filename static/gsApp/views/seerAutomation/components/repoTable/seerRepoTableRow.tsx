import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox/checkbox';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink, Link} from '@sentry/scraps/link/link';
import {Switch} from '@sentry/scraps/switch/switch';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {ProjectList} from 'sentry/components/projectList';
import getRepoStatusLabel from 'sentry/components/repositories/getRepoStatusLabel';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import {
  DEFAULT_CODE_REVIEW_TRIGGERS,
  RepositoryStatus,
  type RepositoryWithSettings,
} from 'sentry/types/integrations';
import {useListItemCheckboxContext} from 'sentry/utils/list/useListItemCheckboxState';
import {useQueryClient} from 'sentry/utils/queryClient';
import useOrganization from 'sentry/utils/useOrganization';

import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {useUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useUpdateRepositorySettings';

interface Props {
  repository: RepositoryWithSettings;
}

export default function SeerRepoTableRow({repository}: Props) {
  const queryClient = useQueryClient();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const {isSelected, toggleSelected} = useListItemCheckboxContext();

  const {mutate: mutateRepositorySettings} = useUpdateRepositorySettings();

  return (
    <SimpleTable.Row key={repository.id}>
      <SimpleTable.RowCell>
        <CheckboxClickTarget htmlFor={`replay-table-select-${repository.id}`}>
          <Checkbox
            id={`replay-table-select-${repository.id}`}
            disabled={isSelected(repository.id) === 'all-selected'}
            checked={isSelected(repository.id) !== false}
            onChange={() => {
              toggleSelected(repository.id);
            }}
          />
        </CheckboxClickTarget>
      </SimpleTable.RowCell>
      <SimpleTable.RowCell>
        <Stack gap="xs">
          <Link to={`/settings/${organization.slug}/seer/repos/${repository.id}/`}>
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
        <ProjectList projectSlugs={[]} />
      </SimpleTable.RowCell>
      <SimpleTable.RowCell justify="end">
        <Switch
          disabled={!canWrite}
          checked={repository.settings?.enabledCodeReview ?? false}
          onChange={e => {
            // TODO update the UI with the new value!
            // See the mess inside of useOrganizationRepositories();
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
                  addErrorMessage(
                    t('Failed to update code review for %s', repository.name)
                  );
                },
                onSuccess: (updatedRepositories: RepositoryWithSettings[]) => {
                  updatedRepositories.forEach(updatedRepository => {
                    queryClient.setQueryData(
                      [
                        `/organizations/${organization.slug}/repos/${updatedRepository.id}/`,
                      ],
                      updatedRepository
                    );
                  });
                  addSuccessMessage(t('Code review updated for %s', repository.name));
                },
              }
            );
          }}
        />
      </SimpleTable.RowCell>
    </SimpleTable.Row>
  );
}

const CheckboxClickTarget = styled('label')`
  cursor: pointer;
  display: block;
  margin: -${p => p.theme.space.md};
  padding: ${p => p.theme.space.md};
  max-width: unset;
  line-height: 0;
`;
