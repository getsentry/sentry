import {Fragment, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';
import capitalize from 'lodash/capitalize';

import {addErrorMessage} from 'sentry/actionCreators/indicator';
import type {ModalRenderProps} from 'sentry/actionCreators/modal';
import type {APIRequestMethod} from 'sentry/api';
import {Button} from 'sentry/components/button';
import ButtonBar from 'sentry/components/buttonBar';
import {Alert} from 'sentry/components/core/alert';
import type {ControlProps} from 'sentry/components/forms/controls/selectControl';
import NewBooleanField from 'sentry/components/forms/fields/booleanField';
import SelectField from 'sentry/components/forms/fields/selectField';
import PanelBody from 'sentry/components/panels/panelBody';
import {PanelTable} from 'sentry/components/panels/panelTable';
import {Tooltip} from 'sentry/components/tooltip';
import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconChevron} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';

import {
  ALLOCATION_SUPPORTED_CATEGORIES,
  AllocationTargetTypes,
} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {SINGULAR_DATA_CATEGORY} from 'getsentry/utils/dataCategory';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

import {bigNumFormatter, BigNumUnits} from '../utils';

import ProjectSelectControl from './projectSelectControl';
import {HalvedGrid} from './styles';
import type {SpendAllocation} from './types';

type AllocationFormProps = {
  fetchSpendAllocations: () => void;
  organization: Organization;
  rootAllocation: SpendAllocation | undefined;
  selectedMetric: string;
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
  const theme = useTheme();
  const [allocationVolume, setAllocationVolume] = useState<number>(0);
  const [errorFields, setErrorFields] = useState<string[]>([]);
  const [showPrice, setShowPrice] = useState<boolean>(false);
  const [selectedMetric, setSelectedMetric] = useState<string>(
    initializedData
      ? initializedData.billingMetric
      : // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
        ALLOCATION_SUPPORTED_CATEGORIES.indexOf(SINGULAR_DATA_CATEGORY[initialMetric]) >
          -1
        ? // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
          SINGULAR_DATA_CATEGORY[initialMetric]
        : ALLOCATION_SUPPORTED_CATEGORIES[0]
  ); // NOTE: singular lowercase datacategories ex. error
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
    return selectedMetric === DataCategoryExact.ATTACHMENT ? 1000 : 1;
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
    return selectedMetric === DataCategoryExact.ATTACHMENT
      ? BigNumUnits.KILO_BYTES
      : BigNumUnits.NUMBERS;
  }, [selectedMetric]);

  useEffect(() => {
    // Reset the form selected targetID if there's already an allocation for it we're not editing
    if (
      targetId &&
      !initializedData &&
      allocatedTargetIds[AllocationTargetTypes.PROJECT] &&
      allocatedTargetIds[AllocationTargetTypes.PROJECT].indexOf(targetId) >= 0
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
          billing_metric: selectedMetric,
          target_id: targetId,
          target_type: AllocationTargetTypes.PROJECT,
          desired_quantity: String(Number(allocationVolume) * incrementSize),
          start_timestamp: new Date(start).getTime() / 1000,
          end_timestamp: new Date(end).getTime() / 1000,
        },
      });
    } catch (err) {
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
        <Title>
          <span>
            {tct('Allocate [category] by [displayType]', {
              // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
              category: capitalize(DATA_CATEGORY_INFO[selectedMetric].plural),
              displayType: showPrice ? t('Spend') : t('Volume'),
            })}
          </span>
          <span>
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
          </span>
        </Title>
      </Header>
      <OffsetBody>
        <FormBody>
          <FormRow>
            <Title>{t('Select Category:')}</Title>
            <Select
              name="category"
              options={ALLOCATION_SUPPORTED_CATEGORIES.filter(category =>
                subscription.planDetails.categories.includes(
                  DATA_CATEGORY_INFO[category].plural
                )
              ).map(category => ({
                value: category,
                label: capitalize(DATA_CATEGORY_INFO[category].plural),
              }))}
              value={selectedMetric}
              onChange={(val: any) => setSelectedMetric(val)}
            />
          </FormRow>
          <FormRow>
            <Title>{t('Select Project:')}</Title>
            {/* TODO: calculate allocated target ids here */}
            <ProjectSelectControl
              filteredIdList={
                !initializedData ? allocatedTargetIds[AllocationTargetTypes.PROJECT]! : []
              }
              value={targetId || ''}
              onChange={onTargetChange}
              disabled={!!initializedData}
            />
          </FormRow>
          <FormRow>
            <Title>
              {tct('Allocation [displayType]:', {
                displayType: showPrice ? 'Spend' : 'Amount',
              })}
            </Title>
            <ButtonBar gap={1}>
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
              <InputWrapper>
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
              </InputWrapper>
              <Button
                aria-label="increase-allocation"
                size="sm"
                icon={<IconChevron size="xs" direction="right" />}
                onClick={() => {
                  setAllocationVolume(
                    showPrice ? spendToVolume(allocationSpend + 1) : allocationVolume + 1
                  );
                }}
              />
            </ButtonBar>
          </FormRow>
        </FormBody>
      </OffsetBody>
      <SubSectionBody headers={[<div key="summary">{t('Allocation Pool Summary')}</div>]}>
        <div>
          {showPrice ? (
            <div>
              <HalvedGrid style={exhaustedEvents ? {color: theme.red400} : {}}>
                <div>{t('Available Unconsumed Spend')}</div>
                <div>
                  {displayPrice({
                    cents: costPerItem * availableUnconsumedEvents,
                  })}
                </div>
              </HalvedGrid>
              <HalvedGrid style={exhaustedEvents ? {color: theme.red400} : {}}>
                <div>{t('Available Unallocated Spend')}</div>
                <div>
                  {displayPrice({
                    cents:
                      costPerItem *
                      (rootAllocation ? rootAllocation.reservedQuantity : 0),
                  })}
                </div>
              </HalvedGrid>
            </div>
          ) : (
            <div>
              <HalvedGrid style={exhaustedEvents ? {color: theme.red400} : {}}>
                <div>{t('Available Unconsumed Events')}</div>
                <div>
                  <Tooltip title={availableUnconsumedEvents}>
                    {bigNumFormatter(availableUnconsumedEvents, 2, metricUnit)}
                  </Tooltip>
                </div>
              </HalvedGrid>
              <HalvedGrid style={exhaustedEvents ? {color: theme.red400} : {}}>
                <div>{t('Available Unallocated Events')}</div>
                <div>
                  <Tooltip title={rootAllocation ? rootAllocation.reservedQuantity : 0}>
                    {bigNumFormatter(
                      rootAllocation ? rootAllocation.reservedQuantity : 0,
                      2,
                      metricUnit
                    )}
                  </Tooltip>
                </div>
              </HalvedGrid>
            </div>
          )}
          {initializedData && !showPrice && (
            <Fragment>
              <HalvedGrid>
                <div>{t('Current Allocation:')}</div>
                <div>{bigNumFormatter(initializedData.reservedQuantity, metricUnit)}</div>
              </HalvedGrid>
              <HalvedGrid style={overConsumedEvents ? {color: theme.red400} : {}}>
                <div>{t('Current Project Consumption:')}</div>
                <div>{bigNumFormatter(initializedData.consumedQuantity, metricUnit)}</div>
              </HalvedGrid>
            </Fragment>
          )}
          {initializedData && showPrice && (
            <Fragment>
              <HalvedGrid>
                <div>{t('Current Allocation')}</div>
                <div>
                  {displayPrice({
                    cents: initializedData.costPerItem * initializedData.reservedQuantity,
                    formatBigNum: true,
                  })}
                </div>
              </HalvedGrid>
              <HalvedGrid style={overConsumedEvents ? {color: theme.red400} : {}}>
                <div>{t('Consumed Spend')}</div>
                <div>
                  {displayPrice({
                    cents: initializedData.costPerItem * initializedData.consumedQuantity,
                    formatBigNum: true,
                  })}
                </div>
              </HalvedGrid>
            </Fragment>
          )}
        </div>
      </SubSectionBody>
      <Footer>
        <ButtonBar gap={1}>
          {((exhaustedEvents && !overBudgetedEvents) ||
            (initializedData && allocationVolume < initializedData.consumedQuantity)) && (
            // attempting to increase, but remaining available events have been exhausted (but still under budget)
            // OR attempting to decrease below consumed events
            <Alert type="error">
              <div>
                {t(
                  'Cannot apply this change to your current period due to consumed amounts.'
                )}
              </div>
            </Alert>
          )}
          {overBudgetedEvents && (
            // attempting to increase over the total available amount
            <Alert type="error">
              <div>
                {t('Cannot allocate more than your subscription Reserved Quota.')}
              </div>
              <div>{t('Free up allocation from existing projects to continue.')}</div>
            </Alert>
          )}
          {!rootAllocation && (
            <Alert type="error">
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

const FormBody = styled('form')`
  padding: ${space(2)};
`;

const FormRow = styled(HalvedGrid)`
  padding: ${space(1)} ${space(2)};
`;

const InputWrapper = styled('div')`
  display: flex;
  align-items: center;
`;

const FancyInput = styled('input')`
  line-height: 1.4;
  font-size: ${p => p.theme.fontSizeMedium};
  border-radius: ${p => p.theme.borderRadius};
  border: 1px ${p => 'solid ' + p.theme.border};
  padding: ${space(1)} ${space(2)};

  ::-webkit-outer-spin-button,
  ::-webkit-inner-spin-button {
    -webkit-appearance: none;
  }
`;

const Toggle = styled(NewBooleanField)`
  margin: 0;
  padding: 0;
`;

const OffsetBody = styled(PanelBody)`
  margin: -${space(3)} -${space(4)};

  @media (max-width: ${p => p.theme.breakpoints.medium}) {
    margin: -${space(3)};
  }
`;

const SubSectionBody = styled(PanelTable)`
  margin-top: ${space(2)};
`;

const Title = styled('div')`
  font-size: ${p => p.theme.fontSizeExtraLarge};
  color: ${p => p.theme.textColor};
  display: flex;
  justify-content: space-between;
`;

const Select = styled(SelectField)`
  padding: 0;
  > div {
    padding-left: 0;
  }
`;
