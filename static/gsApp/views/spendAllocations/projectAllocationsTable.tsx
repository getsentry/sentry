import {useMemo} from 'react';
import styled from '@emotion/styled';

import {InfoText} from '@sentry/scraps/info';
import {Table, type TableColumnConfig} from '@sentry/scraps/table';

import {t} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';

import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';

import {AllocationRow} from './components/allocationRow';
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

const COLUMNS: TableColumnConfig[] = [
  {key: 'project', width: 'minmax(160px, 1fr)'},
  {key: 'allocated-label', width: 120},
  {key: 'allocated-values', width: 180},
  {key: 'consumed-label', width: 120},
  {key: 'consumed-values', width: 180},
  {key: 'actions', width: 100},
];

export function ProjectAllocationsTable({
  deleteSpendAllocation,
  metricUnit,
  openForm,
  selectedMetric,
  spendAllocations = [],
}: Props) {
  const filteredMetrics = useMemo(() => {
    const filtered = spendAllocations.filter(
      allocation =>
        allocation.billingMetric === getCategoryInfoFromPlural(selectedMetric)?.name &&
        allocation.targetType === 'Project'
    );
    // NOTE: This will NOT work once we include multiple layers. We'll need to construct a tree
    return filtered;
  }, [spendAllocations, selectedMetric]);

  return (
    <AllocationsTable aria-label={t('Project allocations')} columns={COLUMNS}>
      <Table.Head>
        <Table.Row>
          <HeaderCell columnKey="project">{t('Project')}</HeaderCell>
          <HeaderCell columnKey="allocated-label" align="right">
            <InfoText
              variant="inherit"
              title={t(
                'Allocated events are guaranteed for your specified projects. If your project goes past its allocated amount, the extra events will consume the root allocation for the organization'
              )}
            >
              {t('Allocated')}
            </InfoText>
          </HeaderCell>
          <HeaderCell columnKey="allocated-values">
            <HalvedWithDivider margin="0">
              <Centered>{t('Spend')}</Centered>
              <Centered>
                <Divider />
              </Centered>
              <Centered>{t('Events')}</Centered>
            </HalvedWithDivider>
          </HeaderCell>
          <HeaderCell columnKey="consumed-label" align="right">
            <InfoText
              variant="inherit"
              title={t('Consumed events indicate your usage per allocation')}
            >
              {t('Consumed')}
            </InfoText>
          </HeaderCell>
          <HeaderCell columnKey="consumed-values">
            <HalvedWithDivider margin="0">
              <Centered>{t('Spend')}</Centered>
              <Centered>
                <Divider />
              </Centered>
              <Centered>{t('Events')}</Centered>
            </HalvedWithDivider>
          </HeaderCell>
          <HeaderCell columnKey="actions" />
        </Table.Row>
      </Table.Head>
      <Table.Body>
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
          <Table.Status>{t('No allocations set')}</Table.Status>
        )}
      </Table.Body>
    </AllocationsTable>
  );
}

const AllocationsTable = styled(Table)`
  background: ${p => p.theme.tokens.background.primary};
  border-radius: ${p => p.theme.radius.md};
  border: 1px ${p => 'solid ' + p.theme.tokens.border.primary};
  box-shadow: ${p => p.theme.shadow.medium};
  margin: ${p => p.theme.space.xl} 0;
  width: 100%;
  max-width: 100%;
  overflow-x: auto;
  overflow-y: hidden;
`;

const HeaderCell = styled(Table.HeadCell)`
  align-items: center;
  color: ${p => p.theme.tokens.content.secondary};
  font-size: ${p => p.theme.font.size.sm};
  font-weight: 600;
  text-transform: uppercase;
  border-radius: ${p => p.theme.radius.md} ${p => p.theme.radius.md} 0 0;
  background: ${p => p.theme.tokens.background.secondary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};
`;
