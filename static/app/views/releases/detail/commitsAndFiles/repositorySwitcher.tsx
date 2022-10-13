import {PureComponent} from 'react';
import {InjectedRouter} from 'react-router';
import styled from '@emotion/styled';
import {Location} from 'history';

import CompactSelect from 'sentry/components/compactSelect';
import {t} from 'sentry/locale';
import space from 'sentry/styles/space';
import {Repository} from 'sentry/types';

type Props = {
  location: Location;
  repositories: Array<Repository>;
  router: InjectedRouter;
  activeRepository?: Repository;
};

class RepositorySwitcher extends PureComponent<Props> {
  handleRepoFilterChange = (activeRepo: string) => {
    const {router, location} = this.props;

    router.push({
      ...location,
      query: {...location.query, cursor: undefined, activeRepo},
    });
  };

  render() {
    const {activeRepository, repositories} = this.props;

    const activeRepo = activeRepository?.name;

    return (
      <StyledCompactSelect
        triggerLabel={activeRepo}
        triggerProps={{prefix: t('Filter')}}
        value={activeRepo}
        options={repositories.map(repo => ({
          value: repo.name,
          label: <RepoLabel>{repo.name}</RepoLabel>,
        }))}
        onChange={opt => this.handleRepoFilterChange(opt?.value)}
      />
    );
  }
}

export default RepositorySwitcher;

const StyledCompactSelect = styled(CompactSelect)`
  margin-bottom: ${space(1)};
`;

const RepoLabel = styled('div')`
  ${p => p.theme.overflowEllipsis}
`;
