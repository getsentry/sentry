import styled from '@emotion/styled';

import {Alert} from '@sentry/scraps/alert/alert';
import {Flex, Stack} from '@sentry/scraps/layout';
import {ExternalLink} from '@sentry/scraps/link/link';
import {Switch} from '@sentry/scraps/switch/switch';
import {Heading, Text} from '@sentry/scraps/text';

import {
  addErrorMessage,
  addLoadingMessage,
  addSuccessMessage,
} from 'sentry/actionCreators/indicator';
import {Breadcrumbs} from 'sentry/components/breadcrumbs';
import {CompactSelect, type SelectOption} from 'sentry/components/core/compactSelect';
import DateTime from 'sentry/components/dateTime';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import {KeyValueTable, KeyValueTableRow} from 'sentry/components/keyValueTable';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelHeader from 'sentry/components/panels/panelHeader';
import PanelItem from 'sentry/components/panels/panelItem';
import {Tag, type TagProps} from 'sentry/components/core/badge/tag';
import getRepoStatusLabel from 'sentry/components/repositories/getRepoStatusLabel';
import {IconOpen} from 'sentry/icons/iconOpen';
import {t} from 'sentry/locale';
import {
  DEFAULT_CODE_REVIEW_TRIGGERS,
  RepositoryStatus,
  type RepositoryWithSettings,
} from 'sentry/types/integrations';
import {space} from 'sentry/styles/space';
import {useQueryClient} from 'sentry/utils/queryClient';
import normalizeUrl from 'sentry/utils/url/normalizeUrl';
import useOrganization from 'sentry/utils/useOrganization';
import {useParams} from 'sentry/utils/useParams';

import SeerSettingsPageWrapper from 'getsentry/views/seerAutomation/components/seerSettingsPageWrapper';
import useCanWriteSettings from 'getsentry/views/seerAutomation/components/useCanWriteSettings';
import {useBulkUpdateRepositorySettings} from 'getsentry/views/seerAutomation/onboarding/hooks/useBulkUpdateRepositorySettings';
import useRepositoryWithSettings, {
  getRepositoryWithSettingsQueryKey,
} from 'getsentry/views/seerAutomation/onboarding/hooks/useRepositoryWithSettings';

type CodeReviewTrigger = (typeof DEFAULT_CODE_REVIEW_TRIGGERS)[number];

const CODE_REVIEW_TRIGGER_OPTIONS: SelectOption<CodeReviewTrigger>[] = [
  {value: 'on_command_phrase', label: t('On Command Phrase')},
  {value: 'on_ready_for_review', label: t('On Ready for Review')},
  {value: 'on_new_commit', label: t('On New Commit')},
];

export default function SeerRepositoryDetails() {
  const {repositoryId} = useParams<{repositoryId: string}>();
  const organization = useOrganization();
  const canWrite = useCanWriteSettings();
  const queryClient = useQueryClient();

  const {
    data: repository,
    isPending,
    isError,
    refetch,
  } = useRepositoryWithSettings({
    repositoryId: repositoryId ?? '',
    enabled: Boolean(repositoryId),
  });

  const {mutate: mutateRepositorySettings, isPending: isMutating} =
    useBulkUpdateRepositorySettings();

  const crumbs = [
    {
      label: t('Repos'),
      to: normalizeUrl(`/settings/${organization.slug}/seer/repos/`),
    },
    {
      label: repository?.name ?? repositoryId ?? t('Repository'),
    },
  ];

  const renderContent = () => {
    if (!repositoryId) {
      return (
        <Alert type="error">
          {t('This page requires a repository identifier in the URL.')}
        </Alert>
      );
    }

    if (isPending) {
      return (
        <Panel>
          <PanelBody>
            <CenteredLoadingIndicator />
          </PanelBody>
        </Panel>
      );
    }

    if (isError || !repository) {
      return (
        <Panel>
          <PanelBody>
            <LoadingError
              message={t('Unable to load repository settings.')}
              onRetry={refetch}
            />
          </PanelBody>
        </Panel>
      );
    }

    const codeReviewTriggers =
      repository.settings?.codeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS;

    return (
      <Stack gap="lg">
        <Panel>
          <PanelHeader>
            <Flex align="center" justify="space-between" gap="md" wrap="wrap">
              <Flex direction="column" gap="xs">
                <Heading as="h3">{repository.name}</Heading>
                <Text variant="muted">{repository.provider.name}</Text>
              </Flex>
              <Tag type={getStatusTagType(repository)}>
                {getRepositoryStatusText(repository)}
              </Tag>
            </Flex>
          </PanelHeader>
          <PanelBody>
            <KeyValueTable>
              <KeyValueTableRow
                keyName={t('Repository ID')}
                value={<code>{repository.id}</code>}
              />
              <KeyValueTableRow
                keyName={t('Integration ID')}
                value={<code>{repository.integrationId}</code>}
              />
              <KeyValueTableRow
                keyName={t('Status')}
                value={getRepositoryStatusText(repository)}
              />
              <KeyValueTableRow
                keyName={t('Provider')}
                value={repository.provider.name}
              />
              <KeyValueTableRow
                keyName={t('External URL')}
                value={
                  repository.url ? (
                    <ExternalLink href={repository.url}>
                      <Flex align="center" gap="xs" justify="flex-end">
                        <span>{repository.url.replace('https://', '')}</span>
                        <IconOpen size="xs" />
                      </Flex>
                    </ExternalLink>
                  ) : (
                    '\u2014'
                  )
                }
              />
              <KeyValueTableRow
                keyName={t('Added')}
                value={<DateTime date={repository.dateCreated} seconds />}
              />
              <KeyValueTableRow
                keyName={t('Code Review')}
                value={
                  repository.settings?.enabledCodeReview ? t('Enabled') : t('Disabled')
                }
              />
            </KeyValueTable>
          </PanelBody>
        </Panel>

        <Panel>
          <PanelHeader>
            <Heading as="h3">{t('Code Review Settings')}</Heading>
          </PanelHeader>
          <PanelBody>
            <SettingRow>
              <SettingCopy>
                <SettingLabel>{t('Enable Code Review')}</SettingLabel>
                <Text variant="muted">
                  {t('Allow Seer to review pull requests for this repository.')}
                </Text>
              </SettingCopy>
              <Switch
                disabled={!canWrite || isMutating}
                checked={repository.settings?.enabledCodeReview ?? false}
                onChange={event => handleToggleCodeReview(event.target.checked, repository)}
              />
            </SettingRow>

            <SettingRow>
              <SettingCopy>
                <SettingLabel>{t('Review Triggers')}</SettingLabel>
                <Text variant="muted">
                  {t(
                    'Choose when Seer should automatically start a code review for new pull requests.'
                  )}
                </Text>
              </SettingCopy>
              <CompactSelect
                multiple
                searchable
                disabled={
                  !canWrite ||
                  isMutating ||
                  !(repository.settings?.enabledCodeReview ?? false)
                }
                value={codeReviewTriggers}
                options={CODE_REVIEW_TRIGGER_OPTIONS}
                menuTitle={t('Select triggers')}
                onChange={options =>
                  handleUpdateTriggers(
                    options?.map(option => option.value) ?? [],
                    repository
                  )
                }
                triggerProps={{
                  placeholder: t('Select triggers'),
                  'aria-label': t('Code review triggers'),
                }}
              />
            </SettingRow>
          </PanelBody>
        </Panel>
      </Stack>
    );
  };

  const handleToggleCodeReview = (
    enabled: boolean,
    currentRepository: RepositoryWithSettings
  ) => {
    const queryKey = getRepositoryWithSettingsQueryKey(organization, currentRepository.id);
    const optimisticData = {
      ...currentRepository,
      settings: {
        codeReviewTriggers:
          currentRepository.settings?.codeReviewTriggers ?? DEFAULT_CODE_REVIEW_TRIGGERS,
        ...currentRepository.settings,
        enabledCodeReview: enabled,
      },
    } satisfies RepositoryWithSettings;

    queryClient.setQueryData(queryKey, [optimisticData, undefined, undefined]);
    addLoadingMessage(t('Updating code review settings…'));

    mutateRepositorySettings(
      {
        enabledCodeReview: enabled,
        codeReviewTriggers: optimisticData.settings?.codeReviewTriggers ?? [],
        repositoryIds: [currentRepository.id],
      },
      {
        onError: () => {
          queryClient.setQueryData(queryKey, [currentRepository, undefined, undefined]);
          addErrorMessage(t('Failed to update code review settings.'));
        },
        onSuccess: updatedRepositories => {
          const updated = updatedRepositories?.find(
            repo => repo.id === currentRepository.id
          );
          if (updated) {
            queryClient.setQueryData(queryKey, [updated, undefined, undefined]);
          }
          addSuccessMessage(t('Code review settings updated.'));
        },
        onSettled: () => {
          queryClient.invalidateQueries({queryKey});
        },
      }
    );
  };

  const handleUpdateTriggers = (
    triggers: CodeReviewTrigger[],
    currentRepository: RepositoryWithSettings
  ) => {
    const queryKey = getRepositoryWithSettingsQueryKey(organization, currentRepository.id);
    const optimisticData = {
      ...currentRepository,
      settings: {
        enabledCodeReview: currentRepository.settings?.enabledCodeReview ?? false,
        ...currentRepository.settings,
        codeReviewTriggers: triggers,
      },
    } satisfies RepositoryWithSettings;

    queryClient.setQueryData(queryKey, [optimisticData, undefined, undefined]);
    addLoadingMessage(t('Updating code review triggers…'));

    mutateRepositorySettings(
      {
        codeReviewTriggers: triggers,
        repositoryIds: [currentRepository.id],
      },
      {
        onError: () => {
          queryClient.setQueryData(queryKey, [currentRepository, undefined, undefined]);
          addErrorMessage(t('Failed to update code review triggers.'));
        },
        onSuccess: updatedRepositories => {
          const updated = updatedRepositories?.find(
            repo => repo.id === currentRepository.id
          );
          if (updated) {
            queryClient.setQueryData(queryKey, [updated, undefined, undefined]);
          }
          addSuccessMessage(t('Code review triggers updated.'));
        },
        onSettled: () => {
          queryClient.invalidateQueries({queryKey});
        },
      }
    );
  };

  return (
    <SeerSettingsPageWrapper>
      <Stack gap="lg">
        <Breadcrumbs crumbs={crumbs} />
        {renderContent()}
      </Stack>
    </SeerSettingsPageWrapper>
  );
}

function getRepositoryStatusText(repository: RepositoryWithSettings) {
  if (repository.status === RepositoryStatus.ACTIVE) {
    return t('Active');
  }
  return getRepoStatusLabel(repository) ?? repository.status;
}

function getStatusTagType(
  repository: RepositoryWithSettings
): NonNullable<TagProps['type']> {
  if (repository.status === RepositoryStatus.ACTIVE) {
    return 'success';
  }
  if (repository.status === RepositoryStatus.PENDING_DELETION) {
    return 'warning';
  }
  if (repository.status === RepositoryStatus.DELETION_IN_PROGRESS) {
    return 'error';
  }
  return 'default';
}

const SettingRow = styled(PanelItem)`
  align-items: center;
  justify-content: space-between;
  gap: ${space(2)};
  flex-wrap: wrap;
`;

const SettingCopy = styled('div')`
  flex: 1;
  min-width: 250px;
`;

const SettingLabel = styled(Text)`
  font-weight: ${p => p.theme.fontWeight.semibold};
`;

const CenteredLoadingIndicator = styled(LoadingIndicator)`
  margin: ${space(1)} auto;
`;

