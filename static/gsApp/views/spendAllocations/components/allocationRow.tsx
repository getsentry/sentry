import {useState} from 'react';
import styled from '@emotion/styled';

import {Button} from 'sentry/components/button';
import {Tooltip} from 'sentry/components/tooltip';
import {IconDelete, IconEdit} from 'sentry/icons';
import {t} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import theme from 'sentry/utils/theme';

import {displayPrice} from 'getsentry/views/amCheckout/utils';

import type {BigNumUnits} from '../utils';
import {bigNumFormatter} from '../utils';

import {Centered, Divider, HalvedWithDivider} from './styles';
import type {SpendAllocation} from './types';

type AllocationRowProps = {
  allocation: SpendAllocation;
  deleteAction: (e: React.MouseEvent) => void;
  metricUnit: BigNumUnits;
  openForm: (e: React.MouseEvent) => void;
};

function AllocationRow({
  allocation,
  deleteAction,
  metricUnit,
  openForm,
}: AllocationRowProps) {
  const [deleteHovered, setDeleteHovered] = useState(false);
  const [editHovered, setEditHovered] = useState(false);
  return (
    <tr data-test-id="allocation-row">
      <TableData>{allocation.targetSlug}</TableData>
      <TableData />
      <TableData>
        <HalvedWithDivider>
          {allocation.costPerItem === 0 && (
            <Centered>
              <Tooltip title="Cost per event is unavailable for base plans">--</Tooltip>
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
            <Tooltip title={allocation.reservedQuantity.toLocaleString()}>
              {bigNumFormatter(allocation.reservedQuantity, undefined, metricUnit)}
            </Tooltip>
          </Centered>
        </HalvedWithDivider>
      </TableData>
      <TableData />
      <TableData>
        <HalvedWithDivider>
          {allocation.costPerItem === 0 && (
            <Centered>
              <Tooltip title="Cost per event is unavailable for base plans">--</Tooltip>
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
            <Tooltip
              title={(allocation.consumedQuantity > allocation.reservedQuantity
                ? `${allocation.consumedQuantity} (${
                    allocation.consumedQuantity - allocation.reservedQuantity
                  } over)`
                : allocation.consumedQuantity
              ).toLocaleString()}
            >
              <span
                style={
                  allocation.consumedQuantity > allocation.reservedQuantity
                    ? {color: theme.red400}
                    : {}
                }
              >
                {bigNumFormatter(allocation.consumedQuantity, 2, metricUnit)}
              </span>
            </Tooltip>
          </Centered>
        </HalvedWithDivider>
      </TableData>
      <TableData style={{textAlign: 'right'}}>
        {allocation.targetType !== 'Organization' && (
          <Button
            aria-label={t('Edit')}
            icon={<IconEdit />}
            size="xs"
            onClick={openForm}
            style={
              editHovered
                ? {color: theme.gray300, marginRight: space(1)}
                : {marginRight: space(1)}
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
            priority="danger"
            style={deleteHovered ? {color: theme.red400} : {}}
            onMouseEnter={() => setDeleteHovered(true)}
            onMouseLeave={() => setDeleteHovered(false)}
            data-test-id="delete"
          />
        )}
      </TableData>
    </tr>
  );
}

export default AllocationRow;

const TableData = styled('td')`
  padding: ${space(2)};
`;
