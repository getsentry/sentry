import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

import {
  checkIsAddOnChildCategory,
  getBilledCategory,
  getReservedBudgetCategoryForAddOn,
  supportsPayg,
} from 'getsentry/utils/billing';
import {sortCategories} from 'getsentry/utils/dataCategory';
import UsageOverviewTableRow from 'getsentry/views/subscriptionPage/usageOverview/components/tableRow';
import type {UsageOverviewTableProps} from 'getsentry/views/subscriptionPage/usageOverview/types';

function UsageOverviewTable({
  organization,
  subscription,
  onRowClick,
  selectedProduct,
  usageData,
}: UsageOverviewTableProps) {
  const addOnDataCategories = Object.values(subscription.planDetails.addOnCategories)
    .flatMap(addOnInfo => addOnInfo.dataCategories)
    .filter(category => checkIsAddOnChildCategory(subscription, category, true));
  const sortedCategories = sortCategories(subscription.categories);
  const showAdditionalSpendColumn =
    subscription.canSelfServe || supportsPayg(subscription);

  return (
    <Table>
      <thead>
        <TableHeaderRow>
          <th>
            <Text bold variant="muted" uppercase>
              {t('Feature')}
            </Text>
          </th>
          <th>
            <Text bold variant="muted" uppercase>
              {t('Usage')}
            </Text>
          </th>
          {showAdditionalSpendColumn && (
            <th>
              <Text bold variant="muted" align="right" uppercase>
                {t('Additional spend')}
              </Text>
            </th>
          )}
        </TableHeaderRow>
      </thead>
      <tbody>
        {sortedCategories
          .filter(
            categoryInfo =>
              // filter out data categories that are part of add-ons
              !addOnDataCategories.includes(categoryInfo.category)
          )
          .map(categoryInfo => {
            const {category} = categoryInfo;

            return (
              <UsageOverviewTableRow
                key={category}
                product={category}
                selectedProduct={selectedProduct}
                onRowClick={onRowClick}
                subscription={subscription}
                usageData={usageData}
                organization={organization}
              />
            );
          })}
        {Object.values(subscription.planDetails.addOnCategories)
          .filter(
            // show add-ons regardless of whether they're enabled
            // as long as they're available
            addOnInfo => subscription.addOns?.[addOnInfo.apiName]?.isAvailable ?? false
          )
          .map(addOnInfo => {
            const {apiName, dataCategories} = addOnInfo;
            const billedCategory = getBilledCategory(subscription, apiName);
            if (!billedCategory) {
              return null;
            }

            // if any sub-category has non-zero or non-reserved budget reserved volume, don't show the add-on
            // we will render the individual sub-categories alone as part of `sortedCategories`
            // NOTE: this assumes that the same is true for all sibling sub-categories of the add-on
            if (
              dataCategories.some(
                category => !checkIsAddOnChildCategory(subscription, category, true)
              )
            ) {
              return null;
            }

            const reservedBudgetCategory = getReservedBudgetCategoryForAddOn(apiName);

            return (
              <Fragment key={apiName}>
                <UsageOverviewTableRow
                  product={apiName}
                  selectedProduct={selectedProduct}
                  onRowClick={onRowClick}
                  subscription={subscription}
                  usageData={usageData}
                  organization={organization}
                />
                {/* Only show sub-categories if it's a reserved budget add-on */}
                {reservedBudgetCategory
                  ? sortedCategories
                      .filter(categoryInfo =>
                        dataCategories.includes(categoryInfo.category)
                      )
                      .map(categoryInfo => {
                        const {category} = categoryInfo;

                        return (
                          <UsageOverviewTableRow
                            key={category}
                            product={category}
                            selectedProduct={selectedProduct}
                            onRowClick={onRowClick}
                            subscription={subscription}
                            isChildProduct
                            parentProduct={apiName}
                            usageData={usageData}
                            organization={organization}
                          />
                        );
                      })
                  : null}
              </Fragment>
            );
          })}
      </tbody>
    </Table>
  );
}

export default UsageOverviewTable;

const Table = styled('table')`
  display: grid;
  grid-template-columns: repeat(3, auto);
  background: ${p => p.theme.tokens.background.primary};
  border-top: 1px solid ${p => p.theme.tokens.border.primary};
  border-radius: 0 0 ${p => p.theme.radius.md} ${p => p.theme.radius.md};
  gap: 0 ${p => p.theme.space['3xl']};
  width: 100%;
  margin: 0;

  & > thead,
  & > tbody,
  & > * > tr {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
  }
`;

const TableHeaderRow = styled('tr')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.tokens.border.primary};
  text-transform: uppercase;
  padding: ${p => p.theme.space.xl};
`;
