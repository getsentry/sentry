import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';
import type {FlowDefinition} from 'sentry/views/codecov/flows/types';

import {FlowsTableRow} from './row';

interface Props {
  data: FlowDefinition[];
  isError: boolean;
  isLoading: boolean;
  onDeleteFlow: (flowId: string) => void;
}

export default function FlowsTable({data, isLoading, isError, onDeleteFlow}: Props) {
  let tableContent: React.ReactNode;
  if (isLoading) {
    tableContent = <SimpleTable.Empty>{t('Loading...')}</SimpleTable.Empty>;
  } else if (isError) {
    tableContent = <SimpleTable.Empty>{t('Error loading flows')}</SimpleTable.Empty>;
  } else if (!data || data.length === 0) {
    tableContent = (
      <SimpleTable.Empty>{t("You haven't created any flows yet")}</SimpleTable.Empty>
    );
  } else {
    tableContent = data.map((flow, index) => (
      <FlowsTableRow
        key={flow.id}
        flow={flow}
        index={index}
        onDeleteFlow={onDeleteFlow}
      />
    ));
  }

  return (
    <FlowsSimpleTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Flow Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Created By')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Status')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Last Seen')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell>{t('Actions')}</SimpleTable.HeaderCell>
      </SimpleTable.Header>
      {tableContent}
    </FlowsSimpleTable>
  );
}

const FlowsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.xs}) {
    grid-template-columns: 3fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.sm}) {
    grid-template-columns: 3fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: 3fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.lg}) {
    grid-template-columns: minmax(0, 3.5fr) 1fr 1fr 1fr 80px;
  }
`;
