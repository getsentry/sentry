import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';

import Confirm from 'sentry/components/confirm';
import Placeholder from 'sentry/components/placeholder';
import {usePreventContext} from 'sentry/components/prevent/context/preventContext';
import {SimpleTable} from 'sentry/components/tables/simpleTable';
import TextCopyInput from 'sentry/components/textCopyInput';
import {t, tct} from 'sentry/locale';
import {useLocation} from 'sentry/utils/useLocation';
import {useNavigate} from 'sentry/utils/useNavigate';
import useOrganization from 'sentry/utils/useOrganization';
import {useRegenerateRepositoryToken} from 'sentry/views/prevent/tokens/repoTokenTable/hooks/useRegenerateRepositoryToken';

type RepoTokenTableResponse = {
  name: string;
  token: string;
};

type Item = RepoTokenTableResponse;

type SortDirection = 'asc' | 'desc';

interface Sort {
  direction: SortDirection;
  field: 'name';
}

export function parseSortFromQuery(sortQuery?: string): Sort | undefined {
  if (!sortQuery) return undefined;

  if (sortQuery === 'name') {
    return {field: 'name', direction: 'asc'};
  }

  if (sortQuery === '-name') {
    return {field: 'name', direction: 'desc'};
  }

  return undefined;
}

interface Props {
  response: {
    data: Item[];
    isLoading: boolean;
    error?: Error | null;
  };
  sort?: Sort;
}

function Skeletons() {
  return (
    <Fragment>
      {Array.from({length: 3}).map((_, index) => (
        <SimpleTable.Row key={index}>
          <SimpleTable.RowCell>
            <Placeholder height="32px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="32px" width="368px" />
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <Placeholder height="32px" width="145px" />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </Fragment>
  );
}

function RegenerateTokenCell({item}: {item: Item}) {
  const organization = useOrganization();
  const {integratedOrgId} = usePreventContext();

  const {mutate: regenerateToken} = useRegenerateRepositoryToken();

  return (
    <Confirm
      onConfirm={() => {
        regenerateToken({
          orgSlug: organization.slug,
          integratedOrgId: integratedOrgId!,
          repository: item.name,
        });
      }}
      header={<h5>{t('Generate new token')}</h5>}
      cancelText={t('Cancel')}
      confirmText={t('Generate new token')}
      isDangerous
      message={tct(
        `Are you sure you want to generate a new token for [repoName]? [break][break] If you create a new token, make sure to update the repository secret in GitHub. [break] [break]`,
        {
          repoName: <strong>{item.name}</strong>,
          break: <br />,
        }
      )}
    >
      <Button size="sm">{t('Regenerate token')}</Button>
    </Confirm>
  );
}

export default function RepoTokenTable({response, sort}: Props) {
  const {data, isLoading} = response;
  const location = useLocation();
  const navigate = useNavigate();

  const handleSort = (field: 'name') => {
    const {
      cursor: _cursor,
      navigation: _navigation,
      ...queryWithoutPagination
    } = location.query;

    const newQuery = {...queryWithoutPagination};

    if (!sort || sort.field !== field) {
      newQuery.sort = field;
    } else if (sort.direction === 'asc') {
      newQuery.sort = `-${field}`;
    } else {
      delete newQuery.sort;
    }

    navigate({
      ...location,
      query: newQuery,
    });
  };

  const headers = (
    <SimpleTable.Header>
      <SimpleTable.HeaderCell
        sort={sort?.field === 'name' ? sort.direction : undefined}
        handleSortClick={() => handleSort('name')}
      >
        {t('Repository name')}
      </SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell>{t('Token')}</SimpleTable.HeaderCell>
      <SimpleTable.HeaderCell />
    </SimpleTable.Header>
  );

  if (isLoading) {
    return (
      <TokenTable>
        {headers}
        <Skeletons />
      </TokenTable>
    );
  }

  if (data.length === 0) {
    return (
      <TokenTable>
        {headers}
        <SimpleTable.Empty>{t('No repository tokens found')}</SimpleTable.Empty>
      </TokenTable>
    );
  }

  return (
    <TokenTable>
      {headers}
      {data.map(item => (
        <SimpleTable.Row key={item.name}>
          <SimpleTable.RowCell>{item.name}</SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <TokenCopyInput size="sm">{item.token}</TokenCopyInput>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell>
            <RegenerateTokenCell item={item} />
          </SimpleTable.RowCell>
        </SimpleTable.Row>
      ))}
    </TokenTable>
  );
}

const TokenTable = styled(SimpleTable)`
  grid-template-columns: 1fr 400px max-content;
`;

const TokenCopyInput = styled(TextCopyInput)`
  width: 100%;
`;
