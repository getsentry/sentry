import {useMemo} from 'react';
import styled from '@emotion/styled';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ActionSelector} from 'sentry/views/insights/common/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';
import {SupportedDatabaseSystem} from 'sentry/views/insights/database/utils/constants';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  databaseCommand?: string;
  system?: string;
  table?: string;
};

export function DatabasePageFilters(props: Props) {
  const {system, databaseCommand, table} = props;

  const additionalQuery = useMemo(() => [`span.system:${system}`], [system]);

  return (
    <PageFilterWrapper>
      <ModulePageFilterBar moduleName={ModuleName.DB} />
      <PageFilterBar condensed>
        <DatabaseSystemSelector />
        <ActionSelector
          moduleName={ModuleName.DB}
          value={databaseCommand ?? ''}
          filters={system ? {'span.system': system} : undefined}
        />
        <DomainSelector
          moduleName={ModuleName.DB}
          value={table ?? ''}
          domainAlias={
            system === SupportedDatabaseSystem.MONGODB ? t('Collection') : t('Table')
          }
          additionalQuery={additionalQuery}
        />
      </PageFilterBar>
    </PageFilterWrapper>
  );
}

const PageFilterWrapper = styled('div')`
  display: flex;
  gap: ${space(3)};
  flex-wrap: wrap;
`;
