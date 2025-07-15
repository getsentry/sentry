import styled from '@emotion/styled';

import {SimpleTable} from 'sentry/components/tables/simpleTable';
import {t} from 'sentry/locale';

import {FlowsTableRow} from './row';
import type {Flow} from '../types';

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

  if (isLoading) {
    return <div>{t('Loading...')}</div>;
  }

  if (response.error) {
    return <div>{t('Error loading flows')}</div>;
  }

  return (
    <FlowsSimpleTable>
      <SimpleTable.Header>
        <SimpleTable.HeaderCell>{t('Flow Name')}</SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell style={{textAlign: 'center'}}>
          {t('Created By')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell style={{textAlign: 'center'}}>
          {t('Status')}
        </SimpleTable.HeaderCell>
        <SimpleTable.HeaderCell style={{textAlign: 'center'}}>
          {t('Last Seen')}
        </SimpleTable.HeaderCell>
        {onDeleteFlow && (
          <SimpleTable.HeaderCell style={{textAlign: 'center'}}>
            {t('Actions')}
          </SimpleTable.HeaderCell>
        )}
      </SimpleTable.Header>
      {data.map((flow, index) => (
        <FlowsTableRow
          key={flow.id || index}
          flow={flow}
          index={index}
          onDeleteFlow={onDeleteFlow}
        />
      ))}
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
