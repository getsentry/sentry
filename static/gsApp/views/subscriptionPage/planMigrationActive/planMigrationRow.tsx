import styled from '@emotion/styled';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {tct} from 'sentry/locale';
import type {DataCategory} from 'sentry/types/core';
import {DataCategoryExact} from 'sentry/types/core';

import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

type Props = DataRow | PriceRow | RenewalPriceRow | PlanRow | ContractRow;

type DataRow = {
  currentValue: number | null;
  nextValue: number | null;
  type: DataCategoryExact;
  hasCredits?: boolean;
  previousType?: DataCategoryExact;
  titleOverride?: string;
};

type PriceRow = {
  currentValue: number;
  discountPrice: number;
  nextValue: number;
  type: 'price';
  hasCredits?: boolean;
};

// RenewalPriceRow shown for AUF plans only to differentiate between the first discount at the migration and second discounts at annual contract renewal
type RenewalPriceRow = {
  currentValue: number;
  discountPrice: number;
  nextValue: number;
  type: 'renewal';
  hasCredits?: boolean;
};

type PlanRow = {
  currentValue: string;
  nextValue: string;
  type: 'plan';
};

type ContractRow = {
  currentValue: string;
  nextValue: string;
  type: 'contract';
};

function formatCategoryRowString(
  category: DataCategoryExact,
  quantity: number | null,
  options: {isAbbreviated: boolean}
): string {
  const reservedWithUnits = formatReservedWithUnits(
    quantity,
    DATA_CATEGORY_INFO[category].plural as DataCategory,
    options
  );
  if (
    category === DataCategoryExact.ATTACHMENT ||
    category === DataCategoryExact.LOG_BYTE
  ) {
    return reservedWithUnits;
  }

  if (category === DataCategoryExact.PROFILE_DURATION) {
    const postfix = reservedWithUnits === '1' ? 'hour' : 'hours';
    return `${reservedWithUnits} ${postfix}`;
  }

  if (category === DataCategoryExact.TRANSACTION) {
    return `${reservedWithUnits} performance units`;
  }

  const displayName = DATA_CATEGORY_INFO[category].displayName;
  const plural = `${displayName}s`;
  return `${reservedWithUnits} ${quantity === 1 ? displayName : plural}`;
}

function PlanMigrationRow(props: Props) {
  let currentValue: React.ReactNode;
  let nextValue: React.ReactNode;
  let discountPrice: string | undefined;
  let currentTitle: React.ReactNode =
    DATA_CATEGORY_INFO[props.type as DataCategoryExact]?.productName ?? props.type;
  const dataTestIdSuffix: string =
    DATA_CATEGORY_INFO[props.type as DataCategoryExact]?.plural ?? props.type;

  const options = {isAbbreviated: true};

  // TODO(data categories): BIL-955
  switch (props.type) {
    case 'plan':
      currentValue = tct('Legacy [currentValue]', {currentValue: props.currentValue});
      nextValue = props.nextValue;
      break;
    case 'contract':
      currentValue = props.currentValue;
      nextValue = props.nextValue;
      break;
    case 'price':
      currentValue = displayPrice({cents: props.currentValue});
      discountPrice = displayPrice({cents: props.discountPrice});
      nextValue = displayPrice({cents: props.nextValue});
      break;
    case 'renewal':
      currentValue = displayPrice({cents: props.currentValue});
      discountPrice = displayPrice({cents: props.discountPrice});
      nextValue = displayPrice({cents: props.nextValue});
      currentTitle = 'renewal price';
      break;
    default: {
      // assume DataCategoryExact
      currentValue = formatCategoryRowString(
        props.previousType ?? props.type,
        props.currentValue,
        options
      );
      const formattedNextValue = formatCategoryRowString(
        props.type,
        props.nextValue,
        options
      );
      nextValue = props.hasCredits ? `${formattedNextValue}*` : formattedNextValue;
      if (props.titleOverride) {
        currentTitle = props.titleOverride;
      }
      break;
    }
  }

  const hasDiscount =
    (props.type === 'price' || props.type === 'renewal') && props.hasCredits;

  return (
    <tr>
      <Title>{currentTitle}</Title>
      <td data-test-id={`current-${dataTestIdSuffix}`}>{currentValue}</td>
      <td>
        <IconArrow size="xs" direction="right" variant="muted" />
      </td>
      {hasDiscount ? (
        <DiscountCell data-test-id={`new-${dataTestIdSuffix}`}>
          <DiscountedPrice>{nextValue}</DiscountedPrice>
          <span>{`${discountPrice}*`}</span>
        </DiscountCell>
      ) : (
        <td data-test-id={`new-${dataTestIdSuffix}`}>{nextValue}</td>
      )}
    </tr>
  );
}

const Title = styled('td')`
  text-transform: capitalize;
`;

const DiscountCell = styled('td')`
  display: flex;
  gap: ${p => p.theme.space.md};
  justify-content: flex-end;
`;

const DiscountedPrice = styled('span')`
  text-decoration: line-through;
  font-weight: 400;
`;

export default PlanMigrationRow;
