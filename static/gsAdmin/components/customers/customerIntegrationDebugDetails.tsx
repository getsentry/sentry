import {useState} from 'react';
import styled from '@emotion/styled';
import moment from 'moment-timezone';

import {Container} from '@sentry/scraps/layout';
import {Heading} from '@sentry/scraps/text';

import {Button} from 'sentry/components/core/button';
import {IconChevron} from 'sentry/icons';
import {space} from 'sentry/styles/space';

import ResultGrid from 'admin/components/resultGrid';

type Props = Partial<React.ComponentProps<typeof ResultGrid>> & {
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

function CustomerIntegrationDebugDetails({orgId, ...props}: Props) {
  const [expandedRows, setExpandedRows] = useState<Set<number>>(new Set());

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
    <ResultGrid
      inPanel
      panelTitle="Integration Debug Details"
      path={`/_admin/customers/${orgId}/`}
      endpoint={`/customers/${orgId}/integrations/`}
      method="GET"
      defaultParams={{per_page: 25}}
      useQueryString={false}
      rowsFromData={(data: IntegrationRow[]) => {
        const transformedRows: any[] = [];
        data.forEach(row => {
          transformedRows.push(row);
          transformedRows.push({
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
              borderless
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
      {...props}
    />
  );
}

const MetadataContent = styled('pre')`
  margin: 0;
  padding: ${space(1.5)};
  border-radius: 4px;
  overflow-x: auto;
  font-size: ${p => p.theme.fontSize.sm};
  font-family: ${p => p.theme.text.familyMono};
  white-space: pre-wrap;
  word-wrap: break-word;
`;

export default CustomerIntegrationDebugDetails;
