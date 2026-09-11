import {useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Table} from '@sentry/scraps/table';

import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';

import {displayPrice} from 'getsentry/views/amCheckout/utils';
import type {BigNumUnits} from 'getsentry/views/spendAllocations/utils';
import {bigNumFormatter} from 'getsentry/views/spendAllocations/utils';

import {Centered, Divider, HalvedWithDivider} from './styles';
import type {SpendAllocation} from './types';

type AllocationRowProps = {
  allocation: SpendAllocation;
  deleteAction: (e: React.MouseEvent) => void;
  metricUnit: BigNumUnits;
  openForm: (e: React.MouseEvent) => void;
};

export function AllocationRow({
  allocation,
  deleteAction,
  metricUnit,
  openForm,
}: AllocationRowProps) {
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [editHovered, setEditHovered] = useState(false);
  const theme = useTheme();

  return (
    <Table.Row data-test-id="allocation-row">
      <AllocationCell columnKey="project">{allocation.targetSlug}</AllocationCell>
      <AllocationCell columnKey="allocated-label" />
      <AllocationCell columnKey="allocated-values">
        <HalvedWithDivider>
          {allocation.costPerItem === 0 && (
            <Centered>
              <InfoText
                variant="inherit"
                title={t('Cost per event is unavailable for base plans')}
              >
                N/A
              </InfoText>
            </Centered>
          )}
          {allocation.costPerItem > 0 && (
            <Centered>
              {displayPrice({
                cents: allocation.costPerItem * allocation.reservedQuantity,
              })}
            </Centered>
          )}
          <Centered>
            <Divider />
          </Centered>
          <Centered>
            <InfoText
              variant="inherit"
              title={allocation.reservedQuantity.toLocaleString()}
            >
              {bigNumFormatter(allocation.reservedQuantity, undefined, metricUnit)}
            </InfoText>
          </Centered>
        </HalvedWithDivider>
      </AllocationCell>
      <AllocationCell columnKey="consumed-label" />
      <AllocationCell columnKey="consumed-values">
        <HalvedWithDivider>
          {allocation.costPerItem === 0 && (
            <Centered>
              <InfoText
                variant="inherit"
                title={t('Cost per event is unavailable for base plans')}
              >
                N/A
              </InfoText>
            </Centered>
          )}
          {allocation.costPerItem > 0 && (
            <Centered>
              {displayPrice({
                cents: allocation.costPerItem * allocation.consumedQuantity,
              })}
            </Centered>
          )}
          <Centered>
            <Divider />
          </Centered>
          <Centered>
            <InfoText
              variant={
                allocation.consumedQuantity > allocation.reservedQuantity
                  ? 'danger'
                  : 'inherit'
              }
              title={(allocation.consumedQuantity > allocation.reservedQuantity
                ? `${allocation.consumedQuantity} (${
                    allocation.consumedQuantity - allocation.reservedQuantity
                  } over)`
                : allocation.consumedQuantity
              ).toLocaleString()}
            >
              {bigNumFormatter(allocation.consumedQuantity, 2, metricUnit)}
            </InfoText>
          </Centered>
        </HalvedWithDivider>
      </AllocationCell>
      <AllocationCell columnKey="actions" style={{textAlign: 'right'}}>
        {allocation.targetType !== 'Organization' && (
          <Button
            aria-label={t('Edit')}
            icon={<IconEdit />}
            size="xs"
            onClick={openForm}
            style={
              editHovered
                ? {color: theme.colors.gray300, marginRight: theme.space.md}
                : {marginRight: theme.space.md}
            }
            onMouseEnter={() => setEditHovered(true)}
            onMouseLeave={() => setEditHovered(false)}
            data-test-id="edit"
          />
        )}
        {allocation.targetType !== 'Organization' && (
          <Button
            aria-label={t('Delete')}
            icon={<IconDelete />}
            size="xs"
            onClick={deleteAction}
            variant="danger"
            style={deleteHovered ? {color: theme.colors.red500} : {}}
            onMouseEnter={() => setDeleteHovered(true)}
            onMouseLeave={() => setDeleteHovered(false)}
            data-test-id="delete"
          />
        )}
      </AllocationCell>
    </Table.Row>
  );
}

const AllocationCell = styled(Table.Cell)`
  padding: ${p => p.theme.space.xl};
`;
