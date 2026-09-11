import {Button} from '@sentry/scraps/button';
import {InfoText} from '@sentry/scraps/info';
import {Container, Flex} from '@sentry/scraps/layout';
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
  return (
    <Table.Row>
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
      <AllocationCell columnKey="actions">
        <Flex justify="end" gap="md">
          {allocation.targetType !== 'Organization' && (
            <Button
              aria-label={t('Edit')}
              icon={<IconEdit />}
              size="xs"
              onClick={openForm}
            />
          )}
          {allocation.targetType !== 'Organization' && (
            <Button
              aria-label={t('Delete')}
              icon={<IconDelete />}
              size="xs"
              onClick={deleteAction}
              variant="danger"
            />
          )}
        </Flex>
      </AllocationCell>
    </Table.Row>
  );
}

function AllocationCell({children, ...props}: React.ComponentProps<typeof Table.Cell>) {
  return (
    <Table.Cell {...props}>
      <Container padding="xl">{children}</Container>
    </Table.Cell>
  );
}
