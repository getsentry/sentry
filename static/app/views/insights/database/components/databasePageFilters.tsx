import styled from '@emotion/styled';

import PageFilterBar from 'sentry/components/organizations/pageFilterBar';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import useOrganization from 'sentry/utils/useOrganization';
import {ModulePageFilterBar} from 'sentry/views/insights/common/components/modulePageFilterBar';
import {ActionSelector} from 'sentry/views/insights/common/views/spans/selectors/actionSelector';
import {DomainSelector} from 'sentry/views/insights/common/views/spans/selectors/domainSelector';
import {DatabaseSystemSelector} from 'sentry/views/insights/database/components/databaseSystemSelector';
import {SupportedDatabaseSystems} from 'sentry/views/insights/database/utils/constants';
import {ModuleName} from 'sentry/views/insights/types';

type Props = {
  system: string;
  databaseCommand?: string;
  table?: string;
};

export function DatabasePageFilters(props: Props) {
  const organization = useOrganization();

  const {system, databaseCommand, table} = props;

  return (
    <PageFilterWrapper>
      <ModulePageFilterBar moduleName={ModuleName.DB} />
      <PageFilterBar condensed>
        {organization.features.includes('performance-queries-mongodb-extraction') && (
          <DatabaseSystemSelector />
        )}
        <ActionSelector
          moduleName={ModuleName.DB}
          value={databaseCommand ?? ''}
          filters={{'span.system': system}}
        />
        <DomainSelector
          moduleName={ModuleName.DB}
          value={table ?? ''}
          domainAlias={
            system === SupportedDatabaseSystems.MONGODB ? t('Collection') : t('Table')
          }
          additionalQuery={[`span.system:${system}`]}
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
