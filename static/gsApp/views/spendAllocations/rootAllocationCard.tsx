import {useMemo} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {Button} from 'sentry/components/core/button';
import {ExternalLink} from 'sentry/components/core/link';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import {IconAdd} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import {toTitleCase} from 'sentry/utils/string/toTitleCase';

import type {Subscription} from 'getsentry/types';
import {displayBudgetName} from 'getsentry/utils/billing';
import {getCategoryInfoFromPlural} from 'getsentry/utils/dataCategory';
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
    const categoryInfo = getCategoryInfoFromPlural(selectedMetric as DataCategory);
    return categoryInfo?.formatting.bigNumUnit ?? BigNumUnits.NUMBERS;
  }, [selectedMetric]);

  return (
    <Container margin="xl 0">
      {!rootAllocation && (
        <Card data-test-id="missing-root">
          <Flex justify="between">
            <Container marginRight="xl">
              {t(
                'There is currently no organization-level allocation for this billing metric.'
              )}
              <Text>
                {t(
                  'An organization-level allocation is required to distribute allocations to projects.'
                )}
              </Text>
              <Text>
                {tct(
                  'Click the button to create one and to enable spend allocation for [selectedMetric].',
                  {
                    selectedMetric,
                  }
                )}
              </Text>
            </Container>
            <Flex justify="center" align="center" area="bt" column="-auto / span 1">
              <Button
                icon={<IconAdd />}
                onClick={createRootAllocation}
                disabled={rootAllocation}
              >
                {t('Create Organization-Level Allocation')}
              </Button>
            </Flex>
          </Flex>
        </Card>
      )}
      {rootAllocation && (
        <Card>
          <HalvedGrid>
            <Container>
              <Container padding="md">
                <Text bold size="lg" variant="muted">
                  {tct('Un-Allocated [selectedMetric] Pool', {
                    selectedMetric: toTitleCase(selectedMetric, {
                      allowInnerUpperCase: true,
                    }),
                  })}
                </Text>
              </Container>
              <Container padding="md">
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
              </Container>
            </Container>
            <Table>
              <colgroup>
                <col style={{width: '50%'}} />
                <col />
                <col />
              </colgroup>
              <tbody>
                <tr>
                  <THead />
                  <THead>{t('$ Spend')}</THead>
                  <THead>{t('Event Volume')}</THead>
                </tr>
                <tr>
                  <Cell>{t('Available')}</Cell>
                  <Cell>
                    {rootAllocation.costPerItem === 0 ? (
                      <Tooltip title={t('Cost per event is unavailable for base plans')}>
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
                  <Cell>{t('Consumed')}</Cell>
                  <Cell>
                    {/* TODO: include OD costs if enabled */}
                    {rootAllocation.costPerItem === 0 ? (
                      <Tooltip title={t('Cost per event is unavailable for base plans')}>
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
                        <span style={{color: theme.red400, marginLeft: theme.space.md}}>
                          {tct('[overCount] over', {
                            overCount: bigNumFormatter(
                              rootAllocation.consumedQuantity -
                                rootAllocation.reservedQuantity,
                              2,
                              metricUnit
                            ),
                          })}
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
    </Container>
  );
}

export default RootAllocationCard;

const Table = styled('table')`
  tr:nth-child(even) {
    background-color: ${p => p.theme.tokens.background.secondary};
  }
`;

const THead = styled('th')`
  padding: ${p => p.theme.space.md};
`;

const Cell = styled('td')`
  padding: ${p => p.theme.space.md};
`;
