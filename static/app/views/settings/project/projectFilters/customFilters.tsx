import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

export function CustomFilters() {
  return (
    <CustomFiltersTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell divider={false}>{t('Active')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell divider={false}>{t('Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell divider={false}>{t('Conditions')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell divider={false}>{t('Created')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell divider={false}>{t('Edited')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell divider={false}>{t('Action')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      <SimpleTable.Empty>{t('No inbound filters found')}</SimpleTable.Empty>
    </CustomFiltersTable>
  );
}

const CustomFiltersTable = styled(SimpleTable)`
  grid-template-columns:
    max-content minmax(0, 1fr) minmax(0, 2fr) max-content max-content
    max-content;
`;
