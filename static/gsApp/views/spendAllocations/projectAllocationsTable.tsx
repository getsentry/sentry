import {useMemo} from 'react';
import styled from '@emotion/styled';

import {Container} from '@sentry/scraps/layout';

import {Tooltip} from 'sentry/components/core/tooltip';
import {t} from 'sentry/locale';
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
    <Container margin="xl 0">
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
              <Tooltip
                title={t(
                  'Allocated events are guaranteed for your specified projects. If your project goes past its allocated amount, the extra events will consume the root allocation for the organization'
                )}
              >
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
              <Tooltip title={t('Consumed events indicate your usage per allocation')}>
                {t('Consumed')}
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
              <td data-test-id="no-allocations" style={{padding: '16px'}}>
                {t('No allocations set')}
              </td>
            </tr>
          )}
        </tbody>
      </Table>
    </Container>
  );
}

export default ProjectAllocationsTable;

const Table = styled('table')`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border-collapse: separate;
  border: 1px ${p => 'solid ' + p.theme.tokens.border.primary};
  box-shadow: ${p => p.theme.dropShadowMedium};
  margin-bottom: ${p => p.theme.space.xl};
  width: 100%;
`;

const HeaderCell = styled('th')`
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.fontSize.sm};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  background: ${p => p.theme.backgroundSecondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;
