import styled from '@emotion/styled';

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
}

export default function FlowsTable({response}: Props) {
  const {data, isLoading} = response;

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
        </SimpleTable.Row>
      ))}
    </FlowsSimpleTable>
  );
}
const FlowsSimpleTable = styled(SimpleTable)`
  grid-template-columns: 1fr;

  @media (min-width: ${p => p.theme.breakpoints.xsmall}) {
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.small}) {
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.medium}) {
    grid-template-columns: 2fr 1fr 1fr 1fr;
  }

  @media (min-width: ${p => p.theme.breakpoints.large}) {
    grid-template-columns: minmax(0, 2.5fr) 1fr 1fr 1fr;
  }
`;
