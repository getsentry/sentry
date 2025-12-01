import {useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Checkbox} from '@sentry/scraps/checkbox';
import {InputGroup} from '@sentry/scraps/input/inputGroup';
import {Flex} from '@sentry/scraps/layout';

import {useOrganizationRepositories} from 'sentry/components/events/autofix/preferences/hooks/useOrganizationRepositories';
import Panel from 'sentry/components/panels/panel';
import PanelBody from 'sentry/components/panels/panelBody';
import PanelItem from 'sentry/components/panels/panelItem';
import Placeholder from 'sentry/components/placeholder';
import {IconSearch} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';

interface RepositorySelectorProps {
  onSelectionChange: (repositories: Repository[]) => void;
  selectedRepositories: Repository[];
}

export function RepositorySelector({
  selectedRepositories,
  onSelectionChange,
}: RepositorySelectorProps) {
  const {data: repositories, isFetching} = useOrganizationRepositories();
  const [searchQuery, setSearchQuery] = useState('');

  const filteredRepositories = useMemo(() => {
    if (!searchQuery) {
      return repositories;
    }
    return repositories.filter(repo =>
      repo.name.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [repositories, searchQuery]);

  const selectedIds = useMemo(
    () => new Set(selectedRepositories.map(repo => repo.id)),
    [selectedRepositories]
  );

  const allSelected =
    filteredRepositories.length > 0 &&
    filteredRepositories.every(repo => selectedIds.has(repo.id));

  const handleToggleAll = () => {
    if (allSelected) {
      const filteredIds = new Set(filteredRepositories.map(repo => repo.id));
      onSelectionChange(selectedRepositories.filter(repo => !filteredIds.has(repo.id)));
    } else {
      const newSelections = [...selectedRepositories];
      filteredRepositories.forEach(repo => {
        if (!selectedIds.has(repo.id)) {
          newSelections.push(repo);
        }
      });
      onSelectionChange(newSelections);
    }
  };

  const handleToggleRepository = (repository: Repository) => {
    if (selectedIds.has(repository.id)) {
      onSelectionChange(selectedRepositories.filter(repo => repo.id !== repository.id));
    } else {
      onSelectionChange([...selectedRepositories, repository]);
    }
  };

  return (
    <RepositorySelectorWrapper>
      <Flex justify="between" align="center" paddingLeft="xl" paddingRight="xl">
        <Label htmlFor="select-all-repositories">
          {tct('Select all [count] repositories', {count: filteredRepositories.length})}
        </Label>
        <Checkbox
          disabled={isFetching || filteredRepositories.length === 0}
          checked={allSelected}
          onChange={handleToggleAll}
          id="select-all-repositories"
        />
      </Flex>

      <div style={{margin: '16px 0'}}>
        <InputGroup>
          <InputGroup.LeadingItems>
            <IconSearch size="sm" />
          </InputGroup.LeadingItems>
          <InputGroup.Input
            type="text"
            name="search"
            placeholder={t('Search available repositories')}
            size="sm"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
          />
        </InputGroup>
      </div>

      {isFetching ? (
        <Placeholder height={MAX_HEIGHT} />
      ) : (
        <RepositoryList>
          <PanelBody>
            {filteredRepositories.map(repository => (
              <RepositoryItem key={repository.id}>
                <Label htmlFor={repository.id}>{repository.name}</Label>
                <Checkbox
                  id={repository.id}
                  checked={selectedIds.has(repository.id)}
                  onChange={() => handleToggleRepository(repository)}
                />
              </RepositoryItem>
            ))}
          </PanelBody>
        </RepositoryList>
      )}
    </RepositorySelectorWrapper>
  );
}

const Label = styled('label')`
  font-weight: ${p => p.theme.fontWeight.normal};
  margin-bottom: 0;
`;

const RepositorySelectorWrapper = styled('div')`
  margin-top: ${p => p.theme.space.md};
  padding: ${p => p.theme.space.lg};
`;

const MAX_HEIGHT = '300px';

const RepositoryList = styled(Panel)`
  max-height: ${MAX_HEIGHT};
  overflow-y: auto;
`;

const RepositoryItem = styled(PanelItem)`
  justify-content: space-between;
  align-items: center;
`;
