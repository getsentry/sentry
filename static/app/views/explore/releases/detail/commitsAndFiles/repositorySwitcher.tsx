import styled from '@emotion/styled';
import {parseAsString, useQueryStates} from 'nuqs';

import {CompactSelect} from '@sentry/scraps/compactSelect';
import {OverlayTrigger} from '@sentry/scraps/overlayTrigger';

import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';

interface RepositorySwitcherProps {
  repositories: Repository[];
  activeRepository?: Repository;
}

export function RepositorySwitcher({
  repositories,
  activeRepository,
}: RepositorySwitcherProps) {
  const [, setQueryParams] = useQueryStates({
    activeRepo: parseAsString,
    cursor: parseAsString,
  });

  const handleRepoFilterChange = (activeRepo: string) => {
    setQueryParams({activeRepo, cursor: null}, {history: 'push'});
  };

  const activeRepo = activeRepository?.name;

  return (
    <CompactSelect
      trigger={triggerProps => (
        <OverlayTrigger.Button {...triggerProps} prefix={t('Filter')}>
          {activeRepo ?? triggerProps.children}
        </OverlayTrigger.Button>
      )}
      value={activeRepo}
      options={repositories.map(repo => ({
        value: repo.name,
        textValue: repo.name,
        label: <RepoLabel>{repo.name}</RepoLabel>,
      }))}
      onChange={opt => handleRepoFilterChange(String(opt?.value))}
    />
  );
}

const RepoLabel = styled('div')`
  display: block;
  width: 100%;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
`;
