import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategory} from 'sentry/types/core';

import type {Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
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
  const theme = useTheme();
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
          <Flex justify="between">
            <NoRootInfo>
              There is currently no organization-level allocation for this billing metric.
              <p>
                An organization-level allocation is required to distribute allocations to
                projects.
              </p>
              Click the button to create one and to enable spend allocation for{' '}
              {selectedMetric}.
            </NoRootInfo>
            <Flex justify="center" align="center" area="bt" column="-auto / span 1">
              <Button
                icon={<IconAdd />}
                onClick={createRootAllocation}
                disabled={rootAllocation}
              >
                Create Organization-Level Allocation
              </Button>
            </Flex>
          </Flex>
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
                  `The un-allocated pool represents the remaining Reserved Volume available for your projects. Excess project consumption will first consume events from your un-allocated pool, and then from your [pricingLink] volume, if available`,
                  {
                    pricingLink: (
                      <ExternalLink href="https://docs.sentry.io/pricing/">
                        {displayBudgetName(subscription.planDetails, {title: true})}
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
  font-size: ${p => p.theme.fontSize.lg};
  padding: ${space(1)};
`;
const Body = styled('div')`
  padding: ${space(1)};
`;

const RootAllocation = styled('div')`
  margin: ${space(2)} 0;
`;

const NoRootInfo = styled('div')`
  margin-right: ${space(2)};
`;

const Table = styled('table')`
  tr:nth-child(even) {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;
const THead = styled('th')`
  padding: ${space(1)};
`;
const Cell = styled('td')`
  padding: ${space(1)};
`;
