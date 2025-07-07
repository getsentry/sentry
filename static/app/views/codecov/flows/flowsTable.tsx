import styled from '@emotion/styled';

import {Button} from 'sentry/components/core/button';
import Link from 'sentry/components/links/link';
import {SimpleTable} from 'sentry/components/workflowEngine/simpleTable';
import {t} from 'sentry/locale';

import type {Flow} from './types';

interface Props {
  response: {
    data: Flow[];
    isLoading: boolean;
    error?: Error | null;
  };
  onDeleteFlow?: (flowId: string) => void;
}

export default function FlowsTable({response, onDeleteFlow}: Props) {
  const {data, isLoading} = response;

  console.log('FlowsTable - Received response:', response);
  console.log('FlowsTable - Data:', data);
  console.log('FlowsTable - Loading:', isLoading);

  if (isLoading) {
    return <div>{t('Loading...')}</div>;
  }

  if (response.error) {
    return <div>{t('Error loading flows')}</div>;
  }

  return (
    <FlowsSimpleTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell name="name">{t('Flow Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="createdBy">
          {t('Created By')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="status">{t('Status')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell name="lastSeen">{t('Last Seen')}</SimpleTable.HeaderCell>
        {onDeleteFlow && (
          <SimpleTable.HeaderCell name="actions">{t('Actions')}</SimpleTable.HeaderCell>
        )}
      </SimpleTable.Header>
      {data.map((row, index) => (
        <SimpleTable.Row key={row.id || index} data-test-id={`row-${index}`}>
          <SimpleTable.RowCell name="name">
            <Link to={`/codecov/flows/${row.id}/`}>{row.name}</Link>
          </SimpleTable.RowCell>
          <SimpleTable.RowCell name="createdBy">{row.createdBy}</SimpleTable.RowCell>
          <SimpleTable.RowCell name="status">{row.status}</SimpleTable.RowCell>
          <SimpleTable.RowCell name="lastSeen">
            {new Date(row.lastSeen).toLocaleDateString()}
          </SimpleTable.RowCell>
          {onDeleteFlow && (
            <SimpleTable.RowCell name="actions">
              <Button size="xs" priority="danger" onClick={() => onDeleteFlow(row.id)}>
                {t('Delete')}
              </Button>
            </SimpleTable.RowCell>
          )}
        </SimpleTable.Row>
      ))}
    </FlowsSimpleTable>
  );
}
const FlowsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2fr 1fr 1fr 1fr 80px;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 2.5fr) 1fr 1fr 1fr 80px;
  }
`;
