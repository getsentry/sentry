import {memo, useCallback, useDeferredValue, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Flex} from '@sentry/scraps/layout';

import Access from 'sentry/components/acl/access';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import useOrganization from 'sentry/utils/useOrganization';
import IntegrationButton from 'sentry/views/settings/organizationIntegrations/integrationButton';
import {IntegrationContext} from 'sentry/views/settings/organizationIntegrations/integrationContext';

import {useSeerOnboardingContext} from 'getsentry/views/seerAutomation/onboarding/hooks/seerOnboardingContext';

export function RepositorySelector() {
  const {
    provider,
    isRepositoriesFetching,
    repositories,
    setCodeReviewRepositories,
    selectedCodeReviewRepositoriesMap,
  } = useSeerOnboardingContext();
  const organization = useOrganization();
  const [searchQuery, setSearchQuery] = useState('');
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const filteredRepositories = useMemo(() => {
    if (!deferredSearchQuery) {
      return repositories ?? [];
    }
    return (
      repositories?.filter(repo =>
        repo.name.toLowerCase().includes(deferredSearchQuery.toLowerCase())
      ) ?? []
    );
  }, [repositories, deferredSearchQuery]);

  const selectedIds = useMemo(
    () =>
      new Set(
        Object.entries(selectedCodeReviewRepositoriesMap)
          .filter(([_, value]) => value)
          .map(([key]) => key)
      ),
    [selectedCodeReviewRepositoriesMap]
  );

  const selected = useMemo(
    () => filteredRepositories.filter(repo => selectedIds.has(repo.id)),
    [filteredRepositories, selectedIds]
  );
  const allSelected =
    filteredRepositories.length > 0 && selected.length === filteredRepositories.length;
  const allUnselected = selected.length === 0;

  // This is gonna lag if we have a lot of repositories, as we need to re-render all rows
  const handleToggleAll = useCallback(() => {
    if (allSelected) {
      setCodeReviewRepositories(
        Object.fromEntries(filteredRepositories.map(repo => [repo.id, false]))
      );
      return;
    }

    setCodeReviewRepositories(
      Object.fromEntries(filteredRepositories.map(repo => [repo.id, true]))
    );
  }, [allSelected, filteredRepositories, setCodeReviewRepositories]);

  const handleToggleRepository = useCallback(
    (repositoryId: string, newValue: boolean) => {
      setCodeReviewRepositories({[repositoryId]: newValue});
    },
    [setCodeReviewRepositories]
  );

  return (
    <Flex direction="column" gap="xl" padding="xl">
      <Flex justify="between" align="center" paddingRight="xl">
        <Label htmlFor="select-all-repositories">
          <MainLabel>{t('AI Code Review')}</MainLabel>
          <Description>
            {tct(
              'For all [count] repos selected, Seer will review your PRs and flag potential bugs ',
              {count: selectedIds.size}
            )}
          </Description>
        </Label>
        <Checkbox
          disabled={isRepositoriesFetching || filteredRepositories.length === 0}
          checked={!allSelected && !allUnselected ? 'indeterminate' : allSelected}
          onChange={handleToggleAll}
          id="select-all-repositories"
        />
      </Flex>

      <InputGroup>
        <InputGroup.LeadingItems>
          <IconSearch size="sm" />
        </InputGroup.LeadingItems>
        <InputGroup.Input
          type="text"
          name="search"
          placeholder={t('Search & filter available repositories')}
          size="sm"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </InputGroup>

      {isRepositoriesFetching ? (
        <Placeholder height={MAX_HEIGHT} />
      ) : (
        <RepositoryList>
          <PanelBody>
            {filteredRepositories.map(repository => (
              <RepositoryRow
                key={repository.id}
                repository={repository}
                checked={selectedIds.has(repository.id)}
                onChange={handleToggleRepository}
              />
            ))}
          </PanelBody>
        </RepositoryList>
      )}

      {provider && (
        <IntegrationContext
          value={{
            provider,
            type: 'first_party',
            installStatus: 'Not Installed', // `AddIntegrationButton` only handles `Disabled`
            analyticsParams: {
              view: 'seer_onboarding_code_review',
              already_installed: false,
            },
          }}
        >
          <Access access={['org:integrations']} organization={organization}>
            {({hasAccess}) =>
              hasAccess ? (
                <p>
                  {tct(
                    `Cant't find a repository? Go [link:manage your GitHub integration] and ensure you have granted access to the correct repositories.`,
                    {
                      link: (
                        <IntegrationButton
                          userHasAccess={hasAccess}
                          onAddIntegration={() => {
                            window.location.reload();
                          }}
                          onExternalClick={() => {}}
                          buttonProps={{
                            buttonText: t('manage your GitHub integration'),
                            priority: 'link',
                          }}
                        />
                      ),
                    }
                  )}
                </p>
              ) : null
            }
          </Access>
        </IntegrationContext>
      )}
    </Flex>
  );
}

const RepositoryRow = memo(
  ({
    repository,
    checked,
    onChange,
  }: {
    checked: boolean;
    onChange: (repositoryId: string, newValue: boolean) => void;
    repository: Repository;
  }) => {
    const handleChange = useCallback(() => {
      onChange?.(repository.id, !checked);
    }, [onChange, repository.id, checked]);
    return (
      <RepositoryItem>
        <Label htmlFor={repository.id}>{repository.name}</Label>
        <Checkbox id={repository.id} checked={checked} onChange={handleChange} />
      </RepositoryItem>
    );
  }
);

const Label = styled('label')`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-bottom: 0;
`;

const MainLabel = styled('div')`
  font-weight: ${p => p.theme.fontWeight.bold};
`;

const Description = styled('div')`
  font-size: ${p => p.theme.fontSize.sm};
  color: ${p => p.theme.subText};
`;

const MAX_HEIGHT = '300px';

const RepositoryList = styled(Panel)`
  max-height: ${MAX_HEIGHT};
  overflow-y: auto;
  margin-bottom: 0;
`;

const RepositoryItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
`;
