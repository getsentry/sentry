import {useMemo} from 'react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Button} from 'sentry/components/button';
import ExternalLink from 'sentry/components/links/externalLink';
import {Tooltip} from 'sentry/components/tooltip';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';
import theme from 'sentry/utils/theme';

import {PlanTier, type Subscription} from 'getsentry/types';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

import {Card, HalvedGrid} from './components/styles';
import type {SpendAllocation} from './components/types';
import {bigNumFormatter, BigNumUnits} from './utils';

type Props = {
  createRootAllocation: (e: React.MouseEvent) => void;
  selectedMetric: string;
  subscription: Subscription;
  rootAllocation?: SpendAllocation;
};

function RootAllocationCard({
  createRootAllocation,
  rootAllocation,
  selectedMetric,
  subscription,
}: Props) {
  const availableEvents = useMemo(() => {
    return rootAllocation
      ? Math.max(rootAllocation.reservedQuantity - rootAllocation.consumedQuantity, 0)
      : 0;
  }, [rootAllocation]);

  const metricUnit = useMemo(() => {
    return selectedMetric === DataCategory.ATTACHMENTS
      ? BigNumUnits.KILO_BYTES
      : BigNumUnits.NUMBERS;
  }, [selectedMetric]);

  return (
    <RootAllocation>
      {!rootAllocation && (
        <Card data-test-id="missing-root">
          <CreateRoot>
            <NoRootInfo>
              There is currently no organization-level allocation for this billing metric.
              <p>
                An organization-level allocation is required to distribute allocations to
                projects.
              </p>
              Click the button to create one and to enable spend allocation for{' '}
              {selectedMetric}.
            </NoRootInfo>
            <EnableRoot>
              <Button
                icon={<IconAdd />}
                onClick={createRootAllocation}
                disabled={rootAllocation}
              >
                Create Organization-Level Allocation
              </Button>
            </EnableRoot>
          </CreateRoot>
        </Card>
      )}
      {rootAllocation && (
        <Card>
          <HalvedGrid>
            <div>
              <Header>
                {t('Un-Allocated ')}
                {capitalize(selectedMetric)}&nbsp;
                {t('Pool')}
              </Header>
              <Body>
                {tct(
                  `The un-allocated pool represents the remaining Reserved Volume available for your projects. Excess project consumption will first consume events from your un-allocated pool, and then from your [odLink] volume, if available`,
                  {
                    odLink: (
                      <ExternalLink href="https://docs.sentry.io/product/accounts/pricing/#on-demand-capacity">
                        {subscription.planTier === PlanTier.AM3
                          ? 'Pay-as-you-go'
                          : 'On-Demand'}
                      </ExternalLink>
                    ),
                  }
                )}
              </Body>
            </div>
            <Table>
              <colgroup>
                <col style={{width: '50%'}} />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <THead />
                  <THead>$ Spend</THead>
                  <THead>Event Volume</THead>
                </tr>
                <tr>
                  <Cell>Available</Cell>
                  <Cell>
                    {rootAllocation.costPerItem === 0 ? (
                      <Tooltip title="Cost per event is unavailable for base plans">
                        --
                      </Tooltip>
                    ) : (
                      displayPrice({
                        cents: rootAllocation.costPerItem * availableEvents,
                      })
                    )}
                  </Cell>
                  <Cell>
                    <Tooltip title={availableEvents.toLocaleString()}>
                      {bigNumFormatter(availableEvents, 2, metricUnit)}
                    </Tooltip>
                  </Cell>
                </tr>
                <tr>
                  <Cell>Consumed</Cell>
                  <Cell>
                    {/* TODO: include OD costs if enabled */}
                    {rootAllocation.costPerItem === 0 ? (
                      <Tooltip title="Cost per event is unavailable for base plans">
                        --
                      </Tooltip>
                    ) : (
                      displayPrice({
                        cents:
                          rootAllocation.costPerItem *
                          Math.min(
                            rootAllocation.reservedQuantity,
                            rootAllocation.consumedQuantity
                          ),
                      })
                    )}
                  </Cell>
                  <Cell>
                    <Tooltip title={rootAllocation.consumedQuantity.toLocaleString()}>
                      {bigNumFormatter(
                        Math.min(
                          rootAllocation.reservedQuantity,
                          rootAllocation.consumedQuantity
                        ),
                        2,
                        metricUnit
                      )}
                    </Tooltip>
                    {rootAllocation.consumedQuantity >
                      rootAllocation.reservedQuantity && (
                      <Tooltip
                        title={
                          rootAllocation.consumedQuantity -
                          rootAllocation.reservedQuantity
                        }
                      >
                        &nbsp;
                        <span style={{color: theme.red400, marginLeft: space(1)}}>
                          (
                          {bigNumFormatter(
                            rootAllocation.consumedQuantity -
                              rootAllocation.reservedQuantity,
                            2,
                            metricUnit
                          )}{' '}
                          over)
                        </span>
                      </Tooltip>
                    )}
                  </Cell>
                </tr>
              </tbody>
            </Table>
          </HalvedGrid>
        </Card>
      )}
    </RootAllocation>
  );
}

export default RootAllocationCard;

const Header = styled('div')`
  display: flex;
  color: ${p => p.theme.gray400};
  font-weight: 600;
  font-size: ${p => p.theme.fontSizeLarge};
  padding: ${space(1)};
`;
const Body = styled('div')`
  padding: ${space(1)};
`;

const RootAllocation = styled('div')`
  margin: ${space(2)} 0;
`;

const CreateRoot = styled('div')`
  display: flex;
  justify-content: space-between;
`;
const EnableRoot = styled('div')`
  grid-column: -auto / span 1;
  grid-area: bt;
  display: flex;
  justify-content: center;
  align-items: center;
`;

const NoRootInfo = styled('div')`
  margin-right: ${space(2)};
`;

const Table = styled('table')`
  tr:nth-child(even) {
    background-color: ${p => p.theme.bodyBackground};
  }
`;
const THead = styled('th')`
  padding: ${space(1)};
`;
const Cell = styled('td')`
  padding: ${space(1)};
`;
