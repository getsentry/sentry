import {Fragment} from 'react';
import styled from '@emotion/styled';

import {Text} from 'sentry/components/core/text';
import {t} from 'sentry/locale';

import {UNLIMITED_RESERVED} from 'getsentry/constants';
import {AddOnCategory} from 'getsentry/types';
import {getBilledCategory, supportsPayg} from 'getsentry/utils/billing';
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
  const addOnDataCategories = Object.values(
    subscription.planDetails.addOnCategories
  ).flatMap(addOnInfo => addOnInfo.dataCategories);
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
              // unless they are unlimited
              !addOnDataCategories.includes(categoryInfo.category) ||
              categoryInfo.reserved === UNLIMITED_RESERVED
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
            // as long as they're launched for the org
            // and none of their sub-categories are unlimited
            // Also do not show Seer if the legacy Seer add-on is enabled
            addOnInfo =>
              (!addOnInfo.billingFlag ||
                organization.features.includes(addOnInfo.billingFlag)) &&
              !addOnInfo.dataCategories.some(
                category =>
                  subscription.categories[category]?.reserved === UNLIMITED_RESERVED
              ) &&
              (addOnInfo.apiName !== AddOnCategory.SEER ||
                !subscription.addOns?.[AddOnCategory.LEGACY_SEER]?.enabled)
          )
          .map(addOnInfo => {
            const {apiName, dataCategories} = addOnInfo;
            const billedCategory = getBilledCategory(subscription, apiName);
            if (!billedCategory) {
              return null;
            }

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
                {sortedCategories
                  .filter(categoryInfo => dataCategories.includes(categoryInfo.category))
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
                  })}
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
  grid-template-columns: auto max-content auto;
  background: ${p => p.theme.background};
  border-top: 1px solid ${p => p.theme.border};
  border-radius: 0 0 ${p => p.theme.borderRadius} ${p => p.theme.borderRadius};
  gap: 0 ${p => p.theme.space['3xl']};
  width: 100%;
  margin: 0;

  thead,
  tbody,
  tr {
    display: grid;
    grid-template-columns: subgrid;
    grid-column: 1 / -1;
  }

  @media (max-width: ${p => p.theme.breakpoints.md}) {
    grid-template-columns: repeat(3, auto);
  }
`;

const TableHeaderRow = styled('tr')`
  background: ${p => p.theme.backgroundSecondary};
  border-bottom: 1px solid ${p => p.theme.border};
  text-transform: uppercase;
  padding: ${p => p.theme.space.xl};
`;
