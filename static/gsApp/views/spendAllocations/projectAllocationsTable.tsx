import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import type {DataCategory} from 'sentry/types/core';

import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';

import AllocationRow from './components/allocationRow';
import {Centered, Divider, HalvedWithDivider} from './components/styles';
import type {SpendAllocation} from './components/types';
import type {BigNumUnits} from './utils';
import {midPeriod} from './utils';

type Props = {
  deleteSpendAllocation: (
    selectedMetric: DataCategory | null,
    targetId: number,
    targetType: string,
    timestamp: number
  ) => (e: React.MouseEvent) => void;
  metricUnit: BigNumUnits;
  openForm: (formData?: SpendAllocation) => (e: React.MouseEvent) => void;
  selectedMetric: DataCategory;
  spendAllocations?: SpendAllocation[];
};

function ProjectAllocationsTable({
  deleteSpendAllocation,
  metricUnit,
  openForm,
  selectedMetric,
  spendAllocations = [],
}: Props) {
  const filteredMetrics: SpendAllocation[] = useMemo(() => {
    const filtered = spendAllocations.filter(
      allocation =>
        allocation.billingMetric === getCategoryInfoFromPlural(selectedMetric)?.name &&
        allocation.targetType === 'Project'
    );
    // NOTE: This will NOT work once we include multiple layers. We'll need to construct a tree
    return filtered;
  }, [spendAllocations, selectedMetric]);

  return (
    <Wrapper>
      <Table data-test-id="allocations-table">
        <colgroup>
          <col />
          <col style={{width: '15%'}} />
          <col style={{width: '15%'}} />
          <col style={{width: '15%'}} />
          <col style={{width: '15%'}} />
          <col style={{width: '15%'}} />
        </colgroup>
        <tbody>
          <tr>
            <HeaderCell>{t('Project')}</HeaderCell>
            <HeaderCell style={{textAlign: 'right'}}>
              <Tooltip title="Allocated events are guaranteed for your specified projects. If your project goes past its allocated amount, the extra events will consume the root allocation for the organization">
                {t('Allocated')}
              </Tooltip>
            </HeaderCell>
            <HeaderCell>
              <HalvedWithDivider>
                <Centered>{t('Spend')}</Centered>
                <Centered>
                  <Divider />
                </Centered>
                <Centered>{t('Events')}</Centered>
              </HalvedWithDivider>
            </HeaderCell>
            <HeaderCell style={{textAlign: 'right'}}>
              <Tooltip title="Consumed events indicate your usage per allocation">
                {t('Consumed')}
              </Tooltip>
            </HeaderCell>
            <HeaderCell>
              <HalvedWithDivider>
                <Centered>Spend</Centered>
                <Centered>
                  <Divider />
                </Centered>
                <Centered>Events</Centered>
              </HalvedWithDivider>
            </HeaderCell>
            <HeaderCell />
          </tr>
          {filteredMetrics.map(a => (
            <AllocationRow
              key={a.id}
              allocation={a}
              deleteAction={deleteSpendAllocation(
                selectedMetric,
                a.targetId,
                a.targetType,
                midPeriod(a.period)
              )}
              openForm={openForm(a)}
              metricUnit={metricUnit}
            />
          ))}
          {!filteredMetrics.length && (
            <tr>
              <TableData data-test-id="no-allocations">
                {t('No allocations set')}
              </TableData>
            </tr>
          )}
        </tbody>
      </Table>
    </Wrapper>
  );
}

export default ProjectAllocationsTable;

const Wrapper = styled('div')`
  margin: ${space(2)} 0;
`;

const Table = styled('table')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border-collapse: separate;
  border: 1px ${p => 'solid ' + p.theme.tokens.border.primary};
  box-shadow: ${p => p.theme.dropShadowMedium};
  margin-bottom: ${space(2)};
  width: 100%;
`;

const HeaderCell = styled('th')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${space(1)} ${space(2)};
`;

const TableData = styled('td')`
  padding: ${space(2)};
`;
