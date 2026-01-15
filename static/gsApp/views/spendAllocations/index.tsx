import {Fragment, useCallback, useEffect, useMemo, useState} from 'react';
import {useTheme} from '@emotion/react';
import styled from '@emotion/styled';

import {SelectTrigger} from '@sentry/scraps/compactSelect/trigger';
import {Container, Grid, Stack} from '@sentry/scraps/layout';

import {openModal} from 'sentry/actionCreators/modal';
import Confirm from 'sentry/components/confirm';
import {Button} from 'sentry/components/core/button';
import {ButtonBar} from 'sentry/components/core/button/buttonBar';
import {LinkButton} from 'sentry/components/core/button/linkButton';
import {CompactSelect} from 'sentry/components/core/compactSelect';
import {ExternalLink} from 'sentry/components/core/link';
import EmptyMessage from 'sentry/components/emptyMessage';
import LoadingError from 'sentry/components/loadingError';
import LoadingIndicator from 'sentry/components/loadingIndicator';
import Pagination from 'sentry/components/pagination';
import Panel from 'sentry/components/panels/panel';
import SentryDocumentTitle from 'sentry/components/sentryDocumentTitle';
import {IconAdd, IconBroadcast} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {DataCategory} from 'sentry/types/core';
import type {Organization} from 'sentry/types/organization';
import useApi from 'sentry/utils/useApi';
import withOrganization from 'sentry/utils/withOrganization';
import SettingsPageHeader from 'sentry/views/settings/components/settingsPageHeader';
import {OrganizationPermissionAlert} from 'sentry/views/settings/organization/organizationPermissionAlert';

import LearnMoreButton from 'getsentry/components/features/learnMoreButton';
import PlanFeature from 'getsentry/components/features/planFeature';
import withSubscription from 'getsentry/components/withSubscription';
import {AllocationTargetTypes} from 'getsentry/constants';
import type {Subscription} from 'getsentry/types';
import {displayPlanName, isAmEnterprisePlan} from 'getsentry/utils/billing';
import {
  getCategoryInfoFromPlural,
  getPlanCategoryName,
} from 'getsentry/utils/dataCategory';
import {isDisabledByPartner} from 'getsentry/utils/partnerships';
import trackGetsentryAnalytics from 'getsentry/utils/trackGetsentryAnalytics';
import SubscriptionPageContainer from 'getsentry/views/subscriptionPage/components/subscriptionPageContainer';
import PartnershipNote from 'getsentry/views/subscriptionPage/partnershipNote';
import {hasPermissions} from 'getsentry/views/subscriptionPage/utils';

import AllocationForm from './components/allocationForm';
import type {SpendAllocation} from './components/types';
import EnableSpendAllocations from './enableSpendAllocations';
import ProjectAllocationsTable from './projectAllocationsTable';
import RootAllocationCard from './rootAllocationCard';
import {BigNumUnits} from './utils';

type Props = {
  organization: Organization;
  subscription: Subscription;
};

export function SpendAllocationsRoot({organization, subscription}: Props) {
  const theme = useTheme();
  const [errors, setErrors] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [orgEnabledFlag, setOrgEnabledFlag] = useState<boolean>(true);
  const [selectedMetric, setSelectedMetric] = useState<DataCategory>(DataCategory.ERRORS);
  const [shouldRetry, setShouldRetry] = useState<boolean>(true);
  const [rootAllocations, setRootAllocations] = useState<SpendAllocation[]>([]);
  const [spendAllocations, setSpendAllocations] = useState<SpendAllocation[]>([]); // NOTE: we default to fetching 1 period
  const [viewNextPeriod, _setViewNextPeriod] = useState<boolean>(false);
  const [currentCursor, setCurrentCursor] = useState<string | undefined>('');
  const [pageLinks, setPageLinks] = useState<string | null>();
  const {planDetails} = subscription;
  const api = useApi();
  const hasBillingPerms = hasPermissions(organization, 'org:billing');
  const hasOrgWritePerms = hasPermissions(organization, 'org:write');
  const canViewSpendAllocation = hasBillingPerms || hasOrgWritePerms;
  const metricUnit = useMemo(() => {
    const categoryInfo = getCategoryInfoFromPlural(selectedMetric);
    return categoryInfo?.formatting.bigNumUnit ?? BigNumUnits.NUMBERS;
  }, [selectedMetric]);

  const supportedCategories = planDetails.categories.filter(
    category => getCategoryInfoFromPlural(category)?.canAllocate
  );

  const period = useMemo<Date[]>(() => {
    const {onDemandPeriodStart, onDemandPeriodEnd} = subscription;
    let start: Date;
    let end: Date;
    if (viewNextPeriod) {
      // NOTE: this is hacky and not a proper representation of the actual subscription periods.
      // There's currently no better way to get billing periods though, so for now we just
      // derive the dates assuming each period is properly 1 month
      start = new Date(onDemandPeriodEnd + 'T00:00:00.000');
      start.setDate(start.getDate() + 1);
      end = new Date(start); // create new date instance
      end.setMonth(end.getMonth() + 1);
    } else {
      start = new Date(onDemandPeriodStart + 'T00:00:00.000');
      end = new Date(onDemandPeriodEnd + 'T23:59:59.999');
    }
    return [start, end];
  }, [viewNextPeriod, subscription]);

  const currentRootAllocations: SpendAllocation[] = useMemo(() => {
    // Return all root allocations that overlap with the selected period
    const [periodStart, periodEnd] = period;
    return rootAllocations.filter(
      allocation =>
        allocation &&
        ((new Date(allocation.period[0]) < periodEnd! && // allocation starts before period ends
          new Date(allocation.period[1]) <= periodEnd!) || // allocation ends before or equal to period end
          (new Date(allocation.period[1]) > periodStart! && // allocation ends after the period starts
            new Date(allocation.period[0]) >= periodStart!)) // allocation starts after or equal to period start
    );
  }, [rootAllocations, period]);

  const currentAllocations: SpendAllocation[] = useMemo(() => {
    // Return all project allocations that overlap with the selected period
    const [periodStart, periodEnd] = period;
    return spendAllocations.filter(
      allocation =>
        allocation &&
        ((new Date(allocation.period[0]) < periodEnd! && // allocation starts before period ends
          new Date(allocation.period[1]) <= periodEnd!) || // allocation ends before or equal to period end
          (new Date(allocation.period[1]) > periodStart! && // allocation ends after the period starts
            new Date(allocation.period[0]) >= periodStart!)) // allocation starts after or equal to period start
    );
  }, [spendAllocations, period]);

  const rootAllocationForMetric: SpendAllocation | undefined = useMemo(() => {
    const root = currentRootAllocations.find(
      a => a.billingMetric === getCategoryInfoFromPlural(selectedMetric)?.name
    );
    return root;
  }, [currentRootAllocations, selectedMetric]);

  const fetchSpendAllocations = useCallback(
    // Target timestamp allows us to specify a period
    // Periods allows us to specify how many periods we want to fetch
    async (targetTimestamp: number | undefined = undefined, periods = 1) => {
      try {
        setIsLoading(true);
        // NOTE: we cannot just use the subscription period start since newly created allocations could start after the period start
        // we cannot use the middle of the subscription period since it's possible to have a current allocation that ends before mid period
        if (!targetTimestamp) {
          targetTimestamp = Math.max(Date.now() / 1000, period[0]!.getTime() / 1000);
        }
        const SPEND_ALLOCATIONS_PATH = `/organizations/${organization.slug}/spend-allocations/`;

        // there should only be one root allocation per billing metric, so we don't need to pass the cursor
        const rootAllocationsResp = await api.requestPromise(SPEND_ALLOCATIONS_PATH, {
          method: 'GET',
          query: {
            timestamp: targetTimestamp,
            periods,
            target_id: organization.id,
            target_type: 'Organization',
          },
        });
        setRootAllocations(rootAllocationsResp);

        const [projectAllocations, _, resp] = await api.requestPromise(
          SPEND_ALLOCATIONS_PATH,
          {
            method: 'GET',
            includeAllArgs: true,
            query: {
              timestamp: targetTimestamp,
              periods,
              target_type: 'Project',
              cursor: currentCursor,
              billing_metric: getCategoryInfoFromPlural(selectedMetric)?.name, // TODO: we should update the endpoint to use camelCase api name
            },
          }
        );
        setOrgEnabledFlag(true);
        setSpendAllocations(projectAllocations);
        setErrors(null);

        const links =
          (resp?.getResponseHeader('Link') || resp?.getResponseHeader('link')) ??
          undefined;
        setPageLinks(links);
      } catch (err: any) {
        if (err.status === 404) {
          setErrors('Error fetching spend allocations');
        } else if (err.status === 403) {
          // NOTE: If spend allocations are not enabled, API will return a 403 not found
          // So capture this case and set enabled to false
          setOrgEnabledFlag(false);
        } else {
          setErrors(err.statusText);
        }
      }
      setIsLoading(false);
      setShouldRetry(true);
    },
    [api, currentCursor, organization.id, organization.slug, period, selectedMetric]
  );

  const deleteSpendAllocation =
    (
      billingMetric: DataCategory | null,
      targetId: number,
      targetType: string,
      timestamp: number
    ) =>
    async (e: React.MouseEvent) => {
      e.preventDefault();
      setErrors(null);
      try {
        const PATH = `/organizations/${organization.slug}/spend-allocations/`;
        await api.requestPromise(PATH, {
          method: 'DELETE',
          query: {
            billing_metric: billingMetric
              ? getCategoryInfoFromPlural(billingMetric)?.name // TODO: we should update the endpoint to use camelCase api name
              : null,
            target_id: targetId,
            target_type: targetType,
            timestamp,
          },
        });
        await fetchSpendAllocations();
      } catch (err: any) {
        setErrors(err.statusText);
      }
    };

  const createRootAllocation = async (e: React.MouseEvent) => {
    e.preventDefault();

    try {
      const PATH = `/organizations/${organization.slug}/spend-allocations/`;
      await api.requestPromise(PATH, {
        method: 'POST',
        data: {
          billing_metric: getCategoryInfoFromPlural(selectedMetric)?.name, // TODO: we should update the endpoint to use camelCase api name
          target_id: organization.id,
          target_type: AllocationTargetTypes.ORGANIZATION,
          desired_quantity: 1,
          start_timestamp: period[0]!.getTime() / 1000,
          end_timestamp: period[1]!.getTime() / 1000,
        },
      });
      await fetchSpendAllocations();
    } catch (err: any) {
      setShouldRetry(false);
      setErrors(err.responseJSON.detail);
    }
  };

  const confirmDisableContent = () => {
    return (
      <div data-test-id="confirm-content">
        {t(
          'This action will delete all the current allocations set. Are you sure you want to disable Spend Allocations?'
        )}
      </div>
    );
  };

  const disableSpendAllocations = async () => {
    try {
      // Clear all allocations
      await api.requestPromise(
        `/organizations/${organization.slug}/spend-allocations/index/`,
        {
          method: 'DELETE',
        }
      );
    } catch (err: any) {
      if (err.status === 409) {
        setErrors('Spend Allocations are already disabled');
      }
    }
    await fetchSpendAllocations();
  };

  useEffect(() => {
    fetchSpendAllocations();
  }, [fetchSpendAllocations, viewNextPeriod]);

  const openForm = (formData?: SpendAllocation) => (e: React.MouseEvent) => {
    e.preventDefault();
    trackGetsentryAnalytics('spend_allocations.open_form', {
      organization,
      subscription,
      create_or_edit: formData ? 'edit' : 'create',
    });
    openModal(
      modalProps => (
        <AllocationForm
          {...modalProps}
          fetchSpendAllocations={fetchSpendAllocations}
          initializedData={formData}
          organization={organization}
          selectedMetric={selectedMetric}
          rootAllocation={rootAllocationForMetric}
          spendAllocations={currentAllocations}
          subscription={subscription}
        />
      ),
      {
        closeEvents: 'escape-key',
      }
    );
  };

  if (!organization.features.includes('spend-allocations')) {
    return (
      <SubscriptionPageContainer background="secondary">
        <PlanFeature organization={organization} features={['spend-allocations']}>
          {({plan}) => (
            <Panel dashedBorder data-test-id="disabled-allocations">
              <EmptyMessage
                size="lg"
                icon={<IconBroadcast />}
                title={t(
                  'Allocate event resources to important projects every billing period.'
                )}
                action={
                  <Container margin="sm">
                    <LearnMoreButton
                      organization={organization}
                      source="allocations-upsell"
                      href="https://docs.sentry.io/product/accounts/quotas/#spend-allocation"
                      external
                    >
                      {t('Documentation')}
                    </LearnMoreButton>
                  </Container>
                }
              >
                {tct(
                  'Spend Allocations prioritize important projects by guaranteeing a monthly volume of events for exclusive consumption. This ensures coverage for your important projects, even during consumption spikes. This feature [planRequirement] or above.',
                  {
                    planRequirement: (
                      <strong>
                        {t(
                          'requires %s %s Plan',
                          isAmEnterprisePlan(plan?.id) ? 'an' : 'a',
                          displayPlanName(plan)
                        )}
                      </strong>
                    ),
                  }
                )}
              </EmptyMessage>
            </Panel>
          )}
        </PlanFeature>
      </SubscriptionPageContainer>
    );
  }

  if (isDisabledByPartner(subscription)) {
    return (
      <SubscriptionPageContainer background="secondary">
        <PartnershipNote subscription={subscription} />
      </SubscriptionPageContainer>
    );
  }

  return (
    <SubscriptionPageContainer background="secondary">
      <SentryDocumentTitle title={t('Spend Allocations')} orgSlug={organization.slug} />
      <SettingsPageHeader
        title={t('Spend Allocations')}
        action={
          !isLoading &&
          orgEnabledFlag && (
            <div>
              {subscription.canSelfServe && hasBillingPerms && (
                <LinkButton
                  aria-label={t('Manage Subscription')}
                  size="sm"
                  style={{marginRight: theme.space.md}}
                  to={`/checkout/${organization.slug}/?referrer=spend_allocations`}
                >
                  {t('Manage Subscription')}
                </LinkButton>
              )}
              <Button
                aria-label={t('New Allocation')}
                priority="primary"
                size="sm"
                data-test-id="new-allocation"
                icon={<IconAdd size="xs" />}
                onClick={openForm()}
              >
                {t('New Allocation')}
              </Button>
            </div>
          )
        }
      />
      <div>
        {tct(
          `Allocate a portion of your subscription's reserved quota to your projects and guarantee a minimum volume for them. Read the [docsLink: docs]`,
          {
            docsLink: (
              <ExternalLink href="https://docs.sentry.io/pricing/quotas/spend-allocation/" />
            ),
          }
        )}
      </div>
      {!isLoading && !canViewSpendAllocation && (
        <Container marginTop="3xl">
          <OrganizationPermissionAlert
            data-test-id="permission-alert"
            message={t(
              'Only users with billing or write permissions can view spend allocation details.'
            )}
          />
        </Container>
      )}
      {canViewSpendAllocation && (
        <Grid
          columns={{xs: 'repeat(3, 1fr)', lg: 'repeat(5, 1fr)'}}
          areas={{xs: '"bb bb dd"', lg: '"bb bb dd . ."'}}
          gap="xl"
          margin="xl 0"
          data-test-id="subhead-actions"
        >
          <StyledButtonBar>
            <Stack align="center" column="2 / 5">
              <strong>
                {!viewNextPeriod && 'Current Period'}
                {viewNextPeriod && 'Next Period'}
              </strong>
              <div>
                {new Date(period[0]!).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
                {' — '}
                {new Date(period[1]!).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                  year: 'numeric',
                })}
              </div>
            </Stack>
          </StyledButtonBar>
          <DropdownDataCategory
            trigger={triggerProps => (
              <SelectTrigger.Button {...triggerProps} prefix={t('Category')} />
            )}
            value={selectedMetric}
            options={supportedCategories
              .filter(category => subscription.planDetails.categories.includes(category))
              .map(category => ({
                value: category,
                label: getPlanCategoryName({
                  plan: subscription.planDetails,
                  category,
                  title: true,
                }),
              }))}
            onChange={opt => {
              setSelectedMetric(opt?.value as DataCategory);
              setCurrentCursor('');
            }}
          />
        </Grid>
      )}
      {isLoading && <LoadingIndicator />}
      {errors && (
        <LoadingError
          onRetry={shouldRetry ? fetchSpendAllocations : undefined}
          message={errors}
        />
      )}
      {!isLoading && !orgEnabledFlag && canViewSpendAllocation && (
        <EnableSpendAllocations
          api={api}
          fetchSpendAllocations={fetchSpendAllocations}
          hasScope={hasBillingPerms || hasOrgWritePerms}
          orgSlug={organization.slug}
          setErrors={setErrors}
        />
      )}
      {!isLoading && orgEnabledFlag && canViewSpendAllocation && (
        <RootAllocationCard
          createRootAllocation={createRootAllocation}
          rootAllocation={rootAllocationForMetric}
          selectedMetric={selectedMetric}
          subscription={subscription}
        />
      )}
      {!isLoading &&
        orgEnabledFlag &&
        rootAllocationForMetric &&
        canViewSpendAllocation && (
          <Fragment>
            <ProjectAllocationsTable
              deleteSpendAllocation={deleteSpendAllocation}
              metricUnit={metricUnit}
              openForm={openForm}
              selectedMetric={selectedMetric}
              spendAllocations={currentAllocations}
            />
            {pageLinks && (
              <Pagination pageLinks={pageLinks} onCursor={setCurrentCursor} />
            )}
          </Fragment>
        )}
      {!isLoading && orgEnabledFlag && canViewSpendAllocation && (
        <Confirm
          onConfirm={() => {
            disableSpendAllocations();
          }}
          renderMessage={confirmDisableContent}
        >
          <Button
            aria-label={t('Disable Spend Allocations')}
            size="sm"
            priority="danger"
            data-test-id="disable"
            disabled={!orgEnabledFlag}
          >
            {t('Disable Spend Allocations')}
          </Button>
        </Confirm>
      )}
    </SubscriptionPageContainer>
  );
}

export default withOrganization(withSubscription(SpendAllocationsRoot));

const DropdownDataCategory = styled(CompactSelect)`
  grid-column: auto / span 1;
  grid-area: dd;

  button[aria-haspopup='listbox'] {
    width: 100%;
    height: 100%;
  }
`;

const StyledButtonBar = styled(ButtonBar)`
  grid-column: auto / span 1;
  grid-area: bb;
`;
