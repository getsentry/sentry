import {Fragment, useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Button} from '@sentry/scraps/button';
import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {addErrorMessage, addSuccessMessage} from 'sentry/actionCreators/indicator';
import {IconChevron} from 'sentry/icons';
import {useApi} from 'sentry/utils/useApi';

import {openAdminConfirmModal} from 'admin/components/adminConfirmationModal';
import {ResultGrid} from 'admin/components/resultGrid';

type Props = {
  orgId: string;
};

type IntegrationRow = {
  dateAdded: string | null;
  gracePeriodEnd: string | null;
  id: number;
  integration: {
    externalId: string;
    id: number;
    metadata: Record<string, any>;
    name: string;
    provider: string;
    status: number;
  };
  status: number;
};

const STATUS_LABELS: Record<number, string> = {
  0: 'Active',
  1: 'Disabled',
  2: 'Pending Deletion',
  3: 'Deletion In Progress',
};

function getStatusLabel(status: number): string {
  return STATUS_LABELS[status] ?? `Unknown (${status})`;
}

export function CustomerIntegrationDebugDetails({orgId}: Props) {
  const api = useApi();
  const [expandedRows, setExpandedRows] = useState(new Set());
  const [refreshKey, setRefreshKey] = useState(0);

  const resetIntegrations = () => {
    openAdminConfirmModal({
      header: <h4>Reset Integrations</h4>,
      confirmText: 'Reset Integrations',
      priority: 'danger',
      modalSpecificContent:
        "Reconcile this organization's integrations with its current plan. Supported integrations will be enabled and their grace periods cleared.",
      onConfirm: data => {
        api.request(`/_admin/customers/${orgId}/integrations/reset/`, {
          method: 'POST',
          data,
          success: () => {
            addSuccessMessage('Integrations reset successfully.');
            setRefreshKey(value => value + 1);
          },
          error: error => {
            addErrorMessage(error.responseText || 'Failed to reset integrations.');
          },
        });
      },
    });
  };

  const toggleRow = (id: number) => {
    setExpandedRows(prev => {
      const newSet = new Set(prev);
      if (newSet.has(id)) {
        newSet.delete(id);
      } else {
        newSet.add(id);
      }
      return newSet;
    });
  };

  return (
    <Fragment>
      <Actions>
        <Button variant="danger" onClick={resetIntegrations}>
          Reset Integrations
        </Button>
      </Actions>
      <ResultGrid
        key={refreshKey}
        inPanel
        panelTitle="Integration Debug Details"
        path={`/_admin/customers/${orgId}/`}
        endpoint={`/customers/${orgId}/integrations/`}
        method="GET"
        defaultParams={{per_page: 10}}
        useQueryString={false}
        rowsFromData={(data: IntegrationRow[]) => {
        const transformedRows: any[] = [];
        data.forEach(row => {
          transformedRows.push(row, {
            _isExpansionRow: true,
            _parentId: row.id,
            _parentData: row,
          });
        });
        return transformedRows;
      }}
      keyForRow={row => (row._isExpansionRow ? `expand-${row._parentId}` : row.id)}
      columns={[
        <th key="expand" style={{width: 40}} />,
        <th key="provider">Provider</th>,
        <th key="integrationStatus">Integration Status</th>,
        <th key="orgIntegrationStatus">Org Integration Status</th>,
        <th key="id" style={{textAlign: 'right'}}>
          Org Integration ID
        </th>,
        <th key="integrationId" style={{textAlign: 'right'}}>
          Integration ID
        </th>,
        <th key="gracePeriodEnd" style={{textAlign: 'right'}}>
          Grace Period End
        </th>,
        <th key="externalId" style={{textAlign: 'right'}}>
          External ID
        </th>,
      ]}
      columnsForRow={(row: any) => {
        if (row._isExpansionRow) {
          const parentRow = row._parentData;
          const isExpanded = expandedRows.has(parentRow.id);
          const hasMetadata =
            parentRow.integration.metadata &&
            Object.keys(parentRow.integration.metadata).length > 0;

          if (!isExpanded || !hasMetadata) {
            return [<td key="empty" colSpan={8} style={{padding: 0, height: 0}} />];
          }

          return [
            <td key="metadata" colSpan={8}>
              <Container>
                <Heading as="h6">Integration Metadata</Heading>
                <MetadataContent>
                  {JSON.stringify(parentRow.integration.metadata, null, 2)}
                </MetadataContent>
              </Container>
            </td>,
          ];
        }

        const isExpanded = expandedRows.has(row.id);
        const hasMetadata =
          row.integration.metadata && Object.keys(row.integration.metadata).length > 0;

        return [
          <td key="expand">
            <Button
              size="zero"
              variant="transparent"
              onClick={() => toggleRow(row.id)}
              icon={<IconChevron size="xs" direction={isExpanded ? 'down' : 'right'} />}
              aria-label={isExpanded ? 'Collapse row' : 'Expand row'}
              disabled={!hasMetadata}
            />
          </td>,
          <td key="provider">{row.integration.provider}</td>,
          <td key="integrationStatus">{getStatusLabel(row.integration.status)}</td>,
          <td key="orgIntegrationStatus">{getStatusLabel(row.status)}</td>,
          <td key="orgIntegrationId" style={{textAlign: 'right'}}>
            {row.id}
          </td>,
          <td key="integrationId" style={{textAlign: 'right'}}>
            {row.integration.id}
          </td>,
          <td key="gracePeriodEnd" style={{textAlign: 'right'}}>
            {row.gracePeriodEnd ? moment(row.gracePeriodEnd).fromNow() : 'n/a'}
          </td>,
          <td key="externalId" style={{textAlign: 'right'}}>
            {row.integration.externalId || 'n/a'}
          </td>,
        ];
        }}
      />
    </Fragment>
  );
}

const Actions = styled('div')`
  display: flex;
  justify-content: flex-end;
  margin-bottom: ${p => p.theme.space.md};
`;

const MetadataContent = styled('pre')`
  margin: 0;
  padding: ${p => p.theme.space.lg};
  border-radius: 4px;
  overflow-x: auto;
  font-size: ${p => p.theme.font.size.sm};
  font-family: ${p => p.theme.font.family.mono};
  white-space: pre-wrap;
  word-wrap: break-word;
`;
