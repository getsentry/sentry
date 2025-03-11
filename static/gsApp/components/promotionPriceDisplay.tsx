import styled from '@emotion/styled';

import {space} from 'sentry/styles/space';

export default function PromotionPriceDisplay({
  price,
  title,
  promo = false,
  showDecimals = true,
}: {
  price: number;
  title: string;
  promo?: boolean;
  showDecimals?: boolean;
}) {
  const priceString = showDecimals ? price.toFixed(2) : price.toString();
  return (
    <div>
      <PriceHeader>{title}</PriceHeader>
      <Price>
        <Currency>$</Currency>
        <Amount promo={promo}>{priceString}</Amount>
        <BillingInterval>{`/mo`}</BillingInterval>
      </Price>
    </div>
  );
}

const PriceHeader = styled('div')`
  text-transform: uppercase;
  font-weight: bold;
  color: ${p => p.theme.gray400};
  font-size: ${p => p.theme.fontSizeMedium};
`;

const Price = styled('div')`
  display: flex;
  color: ${p => p.theme.textColor};
`;

const Currency = styled('div')`
  padding-top: ${space(0.5)};
`;

const Amount = styled('div')<{promo?: boolean}>`
  font-size: 30px;
  font-weight: ${p => (p.promo ? 'bold' : 'none')};
  text-decoration: ${p => (p.promo ? 'none' : 'line-through')};
  color: ${p => (p.promo ? p.theme.headingColor : p.theme.gray300)};
`;

const BillingInterval = styled('div')`
  font-size: ${p => p.theme.fontSizeMedium};
  padding-bottom: 7px;
  align-self: end;
`;
