import styled from '@emotion/styled';

import {DATA_CATEGORY_INFO} from 'sentry/constants';
import {IconArrow} from 'sentry/icons';
import {t, tct} from 'sentry/locale';
import {space} from 'sentry/styles/space';
import {DataCategoryExact} from 'sentry/types/core';

import {formatReservedWithUnits} from 'getsentry/utils/billing';
import {displayPrice} from 'getsentry/views/amCheckout/utils';

type Props = DataRow | PriceRow | RenewalPriceRow | PlanRow | ContractRow;

type DataRow = {
  currentValue: number | null;
  nextValue: number | null;
  type: DataCategoryExact;
  hasCredits?: boolean;
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
    DATA_CATEGORY_INFO[category].plural,
    options
  );
  if (category === DataCategoryExact.ATTACHMENT) {
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
  let discountPrice: React.ReactNode;
  let currentTitle: React.ReactNode =
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    DATA_CATEGORY_INFO[props.type]?.productName ?? props.type;
  const dataTestIdSuffix: React.ReactNode =
    // @ts-expect-error TS(7053): Element implicitly has an 'any' type because expre... Remove this comment to see the full error message
    DATA_CATEGORY_INFO[props.type]?.plural ?? props.type;

  const options = {isAbbreviated: true};

  switch (props.type) {
    case 'plan':
      currentValue = tct('Legacy [currentValue]', {currentValue: props.currentValue});
      nextValue = props.nextValue;
      break;
    case 'contract':
      currentValue = props.currentValue;
      nextValue = props.nextValue;
      break;
    case 'error':
      currentValue = formatCategoryRowString(props.type, props.currentValue, options);
      const formattedErrors = formatCategoryRowString(
        props.type,
        props.nextValue,
        options
      );
      nextValue = props.hasCredits ? `${formattedErrors}*` : formattedErrors;
      break;
    case 'transaction':
    case 'replay':
    case 'monitorSeat':
    case 'attachment':
    case 'profileDuration':
      currentValue = formatCategoryRowString(props.type, props.currentValue, options);
      nextValue = formatCategoryRowString(props.type, props.nextValue, options);
      break;
    case 'span':
      currentValue = formatCategoryRowString(
        DataCategoryExact.TRANSACTION,
        props.currentValue,
        options
      );
      nextValue = formatCategoryRowString(props.type, props.nextValue, options);
      currentTitle = t('Tracing and Performance Monitoring');
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
    default:
      return null;
  }

  const hasDiscount =
    (props.type === 'price' || props.type === 'renewal') && props.hasCredits;

  return (
    <tr>
      <Title>{currentTitle}</Title>
      <td data-test-id={`current-${dataTestIdSuffix}`}>{currentValue}</td>
      <td>
        <IconArrow size="xs" direction="right" color="gray300" />
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
  gap: ${space(1)};
  justify-content: flex-end;
`;

const DiscountedPrice = styled('span')`
  text-decoration: line-through;
  font-weight: 400;
`;

export default PlanMigrationRow;
