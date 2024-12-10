import styled from '@emotion/styled';

import {CompactSelect} from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import type {Repository} from 'sentry/types/integrations';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';

interface RepositorySwitcherProps {
  repositories: Repository[];
  activeRepository?: Repository;
}

function RepositorySwitcher({repositories, activeRepository}: RepositorySwitcherProps) {
  const navigate = useNavigate();
  const location = useLocation();

  const handleRepoFilterChange = (activeRepo: string) => {
    navigate({
      ...location,
      query: {...location.query, cursor: undefined, activeRepo},
    });
  };

  const activeRepo = activeRepository?.name;

  return (
    <CompactSelect
      triggerLabel={activeRepo}
      triggerProps={{prefix: t('Filter')}}
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

export default RepositorySwitcher;

const RepoLabel = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
