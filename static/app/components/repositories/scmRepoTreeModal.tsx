import {Fragment, useState} from 'react';

import {Flex} from '@sentry/scraps/layout';

import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import {ScmIntegrationTree} from 'sentry/components/repositories/scmIntegrationTree/scmIntegrationTree';
import ScmTreeFilters from 'sentry/components/repositories/scmIntegrationTree/scmTreeFilters';
import type {RepoFilter} from 'sentry/components/repositories/scmIntegrationTree/types';
import {t} from 'sentry/locale';

export function ScmRepoTreeModal({Header, Body}: ModalRenderProps) {
  const [search, setSearch] = useState('');
  const [repoFilter, setRepoFilter] = useState<RepoFilter>('all');

  return (
    <Fragment>
      <Header closeButton>
        <h4>{t('Add Repository')}</h4>
      </Header>
      <Body>
        <Flex gap="sm" style={{marginBottom: 12}}>
          <ScmTreeFilters
            repoFilter={repoFilter}
            setRepoFilter={setRepoFilter}
            searchTerm={search}
            setSearchTerm={setSearch}
          />
        </Flex>
        <ScmIntegrationTree
          search={search}
          repoFilter={repoFilter}
          providerFilter="seer-supported"
        />
      </Body>
    </Fragment>
  );
}
