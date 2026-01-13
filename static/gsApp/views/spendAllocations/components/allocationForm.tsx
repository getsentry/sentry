import {Fragment, useEffect, useMemo, useState} from 'react';
import styled from '@emotion/styled';

import {Container, Flex} from '@sentry/scraps/layout';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {APIRequestMethod} from 'sentry/api';
import {Alert} from 'sentry/components/core/alert';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import type {ControlProps} from 'sentry/components/core/select';
import {Text} from 'sentry/components/core/text';
import {Tooltip} from 'sentry/components/core/tooltip';
import NewBooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import PanelBody from 'sentry/components/panels/panelBody';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import {AllocationTargetTypes, BILLED_DATA_CATEGORY_INFO} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPrice} from 'getsentry/views/amCheckout/utils';
import {bigNumFormatter, BigNumUnits} from 'getsentry/views/spendAllocations/utils';

import ProjectSelectControl from './projectSelectControl';
import {HalvedGrid} from './styles';
import type {SpendAllocation} from './types';

type AllocationFormProps = {
  fetchSpendAllocations: () => Promise<void>;
  organization: Organization;
  rootAllocation: SpendAllocation | undefined;
  selectedMetric: DataCategory;
  spendAllocations: SpendAllocation[];
  subscription: Subscription;
  initializedData?: SpendAllocation;
} & ModalRenderProps;

function AllocationForm({
  Footer,
  Header,
  closeModal,
  fetchSpendAllocations,
  initializedData,
  organization,
  selectedMetric: initialMetric,
  rootAllocation,
  spendAllocations,
  subscription,
}: AllocationFormProps) {
  const [allocationVolume, setAllocationVolume] = useState<number>(0);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [showPrice, setShowPrice] = useState<boolean>(false);
  const [selectedMetric, setSelectedMetric] = useState<DataCategory>(
    initializedData
      ? normalizeBillingMetric(initializedData.billingMetric)
      : initialMetric && getCategoryInfoFromPlural(initialMetric)?.canAllocate
        ? initialMetric
        : DataCategory.ERRORS // default to errors
  );
  const [targetId, setTargetId] = useState<string | undefined>(
    initializedData && String(initializedData.targetId)
  );
  const api = useApi();

  const allocatedTargetIds = useMemo<Record<string, string[]>>(() => {
    const allocated: Record<string, string[]> = {};
    spendAllocations.forEach(a => {
      if (!(a.targetType in allocated)) {
        allocated[a.targetType] = [];
      }
      if (a.billingMetric === selectedMetric) {
        allocated[a.targetType]!.push(String(a.targetId));
      }
    });
    return allocated;
  }, [spendAllocations, selectedMetric]);

  const availableUnconsumedEvents = useMemo(() => {
    return rootAllocation
      ? Math.max(rootAllocation.reservedQuantity - rootAllocation.consumedQuantity, 0)
      : 0;
  }, [rootAllocation]);

  const overConsumedEvents = useMemo(() => {
    // The consumed amount is greater than the allocated amount
    return initializedData && initializedData.consumedQuantity > allocationVolume;
  }, [initializedData, allocationVolume]);

  const incrementSize = useMemo(() => {
    return selectedMetric === DataCategory.ATTACHMENTS ? 1000 : 1;
  }, [selectedMetric]);

  const exhaustedEvents = useMemo(() => {
    // The desired allocated volume is greater than the available unconsumed amount
    const additional = initializedData
      ? Number(initializedData.reservedQuantity) / incrementSize
      : 0;
    return allocationVolume > availableUnconsumedEvents + additional;
  }, [availableUnconsumedEvents, allocationVolume, initializedData, incrementSize]);

  const overBudgetedEvents = useMemo(() => {
    // The desired allocated volume is greater than the total available amount
    const additional = initializedData
      ? Number(initializedData.reservedQuantity) / incrementSize
      : 0;
    return (
      allocationVolume >
      (rootAllocation ? rootAllocation.reservedQuantity : 0) + additional
    );
  }, [allocationVolume, initializedData, rootAllocation, incrementSize]);

  const costPerItem = useMemo(() => {
    // NOTE: cost_per_item is returned in cents ($.01)
    return rootAllocation ? rootAllocation.costPerItem : 0;
  }, [rootAllocation]);

  const allocationSpend: number = useMemo(() => {
    return Number(((allocationVolume * costPerItem) / 100).toFixed(2));
  }, [allocationVolume, costPerItem]);

  const metricUnit = useMemo(() => {
    const categoryInfo = getCategoryInfoFromPlural(selectedMetric);
    return categoryInfo?.formatting.bigNumUnit ?? BigNumUnits.NUMBERS;
  }, [selectedMetric]);

  useEffect(() => {
    // Reset the form selected targetID if there's already an allocation for it we're not editing
    if (
      targetId &&
      !initializedData &&
      allocatedTargetIds[AllocationTargetTypes.PROJECT]?.includes(targetId)
    ) {
      setTargetId(undefined);
      setAllocationVolume(0);
    } else if (initializedData) {
      setAllocationVolume(Number(initializedData.reservedQuantity) / incrementSize);
      setTargetId(String(initializedData.targetId));
    }
  }, [allocatedTargetIds, targetId, initializedData, incrementSize]);

  const onAllocationChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const number = e.target.value;
    let quantity: number;
    if (showPrice) {
      // convert spend to volume
      quantity = spendToVolume(Number(number).toFixed(2));
    } else {
      quantity = Math.max(Math.round(Number(number)), 0);
    }
    setAllocationVolume(quantity);
  };

  const onTargetChange: ControlProps['onChange'] = selection => {
    setTargetId(selection!.value);
  };

  const spendToVolume = (spend: unknown) => {
    return costPerItem ? Math.ceil(Math.max(Number(spend), 0) / (costPerItem / 100)) : 0; // costPerItem is in cents while spend is in $
  };

  const validateForm = () => {
    const fields: string[] = [];
    if (!targetId) {
      fields.push('targetId');
    }
    if (Number(allocationVolume) < 0) {
      fields.push('eventAllocation');
    }
    setErrorFields(fields);
    return Boolean(fields.length);
  };

  const onSubmit = async (e: React.MouseEvent) => {
    e.preventDefault();
    const hasErrors = validateForm();

    if (hasErrors) {
      addErrorMessage(t('Please validate your form values are correct'));
      return;
    }
    let METHOD = 'POST';
    let [start, end] = (rootAllocation as SpendAllocation).period;
    if (initializedData) {
      METHOD = 'PUT';
      [start, end] = initializedData.period;
    }
    const PATH = `/organizations/${organization.slug}/spend-allocations/`;
    try {
      await api.requestPromise(PATH, {
        method: METHOD as APIRequestMethod,
        data: {
          billing_metric: getCategoryInfoFromPlural(selectedMetric)?.name, // TODO: we should update the endpoint to use camelCase api name
          target_id: targetId,
          target_type: AllocationTargetTypes.PROJECT,
          desired_quantity: String(Number(allocationVolume) * incrementSize),
          start_timestamp: new Date(start).getTime() / 1000,
          end_timestamp: new Date(end).getTime() / 1000,
        },
      });
    } catch (err: any) {
      addErrorMessage(err.responseJSON.detail);
      return;
    }

    await fetchSpendAllocations();
    trackGetsentryAnalytics('spend_allocations.submit', {
      organization,
      subscription,
      create_or_edit: initializedData ? 'edit' : 'create',
    });
    closeModal();
  };

  return (
    <div data-test-id="spend-allocation-form">
      <Header>
        <Flex justify="between">
          <Text size="xl">
            {tct('Allocate [category] by [displayType]', {
              category: getPlanCategoryName({
                plan: subscription.planDetails,
                category: selectedMetric,
                title: true,
              }),
              displayType: showPrice ? t('Spend') : t('Volume'),
            })}
          </Text>
          <Tooltip
            title={
              <div>
                {t('Allocate via Spend')}
                {!costPerItem && (
                  <div>
                    {t(
                      '(not available for base plans. Contact sales@sentry.io to increase your limit)'
                    )}
                  </div>
                )}
              </div>
            }
          >
            <Toggle
              name={t('showSpend')}
              onChange={(value: any) => setShowPrice(value)}
              value={showPrice}
              disabled={!costPerItem}
              data-test-id="toggle-spend"
            />
          </Tooltip>
        </Flex>
      </Header>
      <OffsetBody>
        <Container padding="xl">
          <form>
            <HalvedGrid>
              <Text size="xl">{t('Select Category:')}</Text>
              <Select
                name="category"
                options={subscription.planDetails.categories
                  .filter(category => getCategoryInfoFromPlural(category)?.canAllocate)
                  .map(category => ({
                    value: category,
                    label: getPlanCategoryName({
                      plan: subscription.planDetails,
                      category,
                      title: true,
                    }),
                  }))}
                value={selectedMetric}
                onChange={(val: any) => setSelectedMetric(val)}
              />
            </HalvedGrid>
            <HalvedGrid padding="md lg">
              <Text size="xl">{t('Select Project:')}</Text>
              {/* TODO: calculate allocated target ids here */}
              <ProjectSelectControl
                filteredIdList={
                  initializedData
                    ? []
                    : allocatedTargetIds[AllocationTargetTypes.PROJECT]!
                }
                value={targetId || ''}
                onChange={onTargetChange}
                disabled={!!initializedData}
              />
            </HalvedGrid>
            <HalvedGrid padding="md lg">
              <Text size="xl">
                {tct('Allocation [displayType]:', {
                  displayType: showPrice ? 'Spend' : 'Amount',
                })}
              </Text>
              <ButtonBar>
                <Button
                  aria-label="reduce-allocation"
                  size="sm"
                  icon={<IconChevron size="xs" direction="left" />}
                  onClick={() => {
                    setAllocationVolume(
                      Math.max(
                        showPrice
                          ? spendToVolume(allocationSpend - 1)
                          : allocationVolume - 1,
                        0
                      )
                    );
                  }}
                />
                <Flex align="center">
                  <FancyInput
                    value={showPrice ? allocationSpend : allocationVolume}
                    placeholder="0"
                    type="number"
                    onChange={onAllocationChange}
                    data-test-id="allocation-input"
                    step={showPrice ? '0.01' : '1'}
                    style={
                      errorFields.indexOf('allocationVolume') > 0 ||
                      exhaustedEvents ||
                      overConsumedEvents // the allocation has consumed more than it was allocated
                        ? {border: '1px solid red'}
                        : {}
                    }
                  />
                  &nbsp;
                  {showPrice ? '$' : metricUnit === BigNumUnits.KILO_BYTES && 'KB'}
                </Flex>
                <Button
                  aria-label="increase-allocation"
                  size="sm"
                  icon={<IconChevron size="xs" direction="right" />}
                  onClick={() => {
                    setAllocationVolume(
                      showPrice
                        ? spendToVolume(allocationSpend + 1)
                        : allocationVolume + 1
                    );
                  }}
                />
              </ButtonBar>
            </HalvedGrid>
          </form>
        </Container>
      </OffsetBody>
      <Container marginTop="xl">
        <PanelTable headers={[<div key="summary">{t('Allocation Pool Summary')}</div>]}>
          <div>
            {showPrice ? (
              <div>
                <HalvedGrid>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {t('Available Unconsumed Spend')}
                  </Text>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {displayPrice({
                      cents: costPerItem * availableUnconsumedEvents,
                    })}
                  </Text>
                </HalvedGrid>
                <HalvedGrid>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {t('Available Unallocated Spend')}
                  </Text>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {displayPrice({
                      cents:
                        costPerItem *
                        (rootAllocation ? rootAllocation.reservedQuantity : 0),
                    })}
                  </Text>
                </HalvedGrid>
              </div>
            ) : (
              <div>
                <HalvedGrid>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {t('Available Unconsumed Events')}
                  </Text>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    <Tooltip title={availableUnconsumedEvents}>
                      {bigNumFormatter(availableUnconsumedEvents, 2, metricUnit)}
                    </Tooltip>
                  </Text>
                </HalvedGrid>
                <HalvedGrid>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    {t('Available Unallocated Events')}
                  </Text>
                  <Text variant={exhaustedEvents ? 'danger' : 'primary'}>
                    <Tooltip title={rootAllocation ? rootAllocation.reservedQuantity : 0}>
                      {bigNumFormatter(
                        rootAllocation ? rootAllocation.reservedQuantity : 0,
                        2,
                        metricUnit
                      )}
                    </Tooltip>
                  </Text>
                </HalvedGrid>
              </div>
            )}
            {initializedData && !showPrice && (
              <Fragment>
                <HalvedGrid>
                  <div>{t('Current Allocation:')}</div>
                  <div>
                    {bigNumFormatter(initializedData.reservedQuantity, metricUnit)}
                  </div>
                </HalvedGrid>
                <HalvedGrid>
                  <Text variant={overConsumedEvents ? 'danger' : 'primary'}>
                    {t('Current Project Consumption:')}
                  </Text>
                  <Text variant={overConsumedEvents ? 'danger' : 'primary'}>
                    {bigNumFormatter(initializedData.consumedQuantity, metricUnit)}
                  </Text>
                </HalvedGrid>
              </Fragment>
            )}
            {initializedData && showPrice && (
              <Fragment>
                <HalvedGrid>
                  <div>{t('Current Allocation')}</div>
                  <div>
                    {displayPrice({
                      cents:
                        initializedData.costPerItem * initializedData.reservedQuantity,
                      formatBigNum: true,
                    })}
                  </div>
                </HalvedGrid>
                <HalvedGrid>
                  <Text variant={overConsumedEvents ? 'danger' : 'primary'}>
                    {t('Consumed Spend')}
                  </Text>
                  <Text variant={overConsumedEvents ? 'danger' : 'primary'}>
                    {displayPrice({
                      cents:
                        initializedData.costPerItem * initializedData.consumedQuantity,
                      formatBigNum: true,
                    })}
                  </Text>
                </HalvedGrid>
              </Fragment>
            )}
          </div>
        </PanelTable>
      </Container>
      <Footer>
        <ButtonBar>
          {((exhaustedEvents && !overBudgetedEvents) ||
            (initializedData && allocationVolume < initializedData.consumedQuantity)) && (
            // attempting to increase, but remaining available events have been exhausted (but still under budget)
            // OR attempting to decrease below consumed events
            <Alert variant="danger" showIcon={false}>
              <div>
                {t(
                  'Cannot apply this change to your current period due to consumed amounts.'
                )}
              </div>
            </Alert>
          )}
          {overBudgetedEvents && (
            // attempting to increase over the total available amount
            <Alert variant="danger" showIcon={false}>
              <div>
                {t('Cannot allocate more than your subscription Reserved Quota.')}
              </div>
              <div>{t('Free up allocation from existing projects to continue.')}</div>
            </Alert>
          )}
          {!rootAllocation && (
            <Alert variant="danger" showIcon={false}>
              <div>
                {t(
                  'There is currently no organization-level allocation for this billing metric.'
                )}
              </div>
              <div>
                {t(
                  'An organization-level allocation is required to distribute allocations to projects.'
                )}
              </div>
            </Alert>
          )}
          <Button onClick={closeModal}>{t('Cancel')}</Button>
          <Button
            data-test-id="spend-allocation-submit"
            priority="primary"
            onClick={onSubmit}
            disabled={overBudgetedEvents || !rootAllocation}
          >
            {initializedData ? t('Save Changes') : t('Submit')}
          </Button>
        </ButtonBar>
      </Footer>
    </div>
  );
}

export default withOrganization(AllocationForm);

const FancyInput = styled('input')`
  line-height: 1.4;
  font-size: ${p => p.theme.fontSize.md};
  border-radius: ${p => p.theme.radius.md};
  border: 1px ${p => 'solid ' + p.theme.tokens.border.primary};
  padding: ${p => p.theme.space.md} ${p => p.theme.space.xl};

  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }

  /* Hide Firefox's native number input steppers to prevent duplicate UI with custom increment/decrement buttons */
  &[type='number'] {
    -moz-appearance: textfield;
  }
`;

const Toggle = styled(NewBooleanField)`
  margin: 0;
  padding: 0;
`;

const OffsetBody = styled(PanelBody)`
  margin: -${p => p.theme.space['2xl']} -${p => p.theme.space['3xl']};

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    margin: -${p => p.theme.space['2xl']};
  }
`;

const Select = styled(SelectField)`
  padding: 0;
  > div {
    padding-left: 0;
  }
`;

// Normalizes singular billingMetric values to match DataCategory enum using BILLED_DATA_CATEGORY_INFO
function normalizeBillingMetric(metric: string): DataCategory {
  return (
    Object.values(BILLED_DATA_CATEGORY_INFO)
      .filter(info => info.canAllocate)
      .find(c => c.name === metric)?.plural ?? (metric as DataCategory)
  );
}
