import styled from '@emotion/styled';

import GridEditable, {COL_WIDTH_UNDEFINED} from 'sentry/components/gridEditable';
import Link from 'sentry/components/links/link';
import {t} from 'sentry/locale';
import {Container} from 'sentry/utils/discover/styles';

import type {Flow} from './types';

interface Props {
  response: {
    data: Flow[];
    isLoading: boolean;
    error?: Error | null;
  };
  sort?: {field: string; kind: string};
}

const renderHeadCell = (column: any) => column.name;

const renderBodyCell = (column: any, row: Flow) => {
  switch (column.key) {
    case 'name':
      return (
        <Container>
          <Link to={`/codecov/replay-assertions/${row.id}/`}>{row.name}</Link>
        </Container>
      );
    case 'createdBy':
      return row.createdBy;
    case 'status':
      return <StatusCell status={row.status}>{row.status}</StatusCell>;
    case 'lastSeen':
      return new Date(row.lastSeen).toLocaleDateString();
    case 'lastChecked':
      return new Date(row.lastChecked).toLocaleDateString();
    case 'failures':
      return <FailuresCell failures={row.failures}>{row.failures}</FailuresCell>;
    case 'linkedIssues':
      return row.linkedIssues.length > 0 ? row.linkedIssues.join(', ') : t('None');
    default:
      return null;
  }
};

const columnOrder = [
  {key: 'name', name: t('Flow Name'), width: COL_WIDTH_UNDEFINED},
  {key: 'createdBy', name: t('Created By'), width: COL_WIDTH_UNDEFINED},
  {key: 'status', name: t('Status'), width: COL_WIDTH_UNDEFINED},
  {key: 'lastSeen', name: t('Last Seen'), width: COL_WIDTH_UNDEFINED},
  {key: 'lastChecked', name: t('Last Checked'), width: COL_WIDTH_UNDEFINED},
  {key: 'failures', name: t('Failures'), width: COL_WIDTH_UNDEFINED},
  {key: 'linkedIssues', name: t('Linked Issues'), width: COL_WIDTH_UNDEFINED},
];

export default function FlowsTable({response, sort}: Props) {
  const {data, isLoading} = response;

  return (
    <GridEditable
      aria-label={t('Flows')}
      isLoading={isLoading}
      error={response.error}
      data={data}
      columnOrder={columnOrder}
      grid={{
        renderHeadCell,
        renderBodyCell,
      }}
    />
  );
}

const StatusCell = styled('div')<{status: string}>`
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  background-color: ${p => (p.status === 'Active' ? p.theme.success : p.theme.gray200)};
  color: ${p => (p.status === 'Active' ? p.theme.white : p.theme.gray500)};
`;

const FailuresCell = styled('div')<{failures: number}>`
  font-weight: 600;
  color: ${p => (p.failures > 0 ? p.theme.error : p.theme.success)};
`;
