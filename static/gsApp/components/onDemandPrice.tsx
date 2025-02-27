import {Tooltip} from 'sentry/components/tooltip';
import {tct} from 'sentry/locale';

import {displayUnitPrice} from 'getsentry/views/amCheckout/utils';

type Props = {
  pricePerEvent: number;
};

function OnDemandPrice({pricePerEvent}: Props) {
  const dollarsPerEvent = displayUnitPrice({cents: pricePerEvent});
  const millPerEvent = Number(pricePerEvent * 10 * 10000) / 10000;

  return (
    <Tooltip title={tct('Equivalent to [millPerEvent] ₥', {millPerEvent})}>
      <span>{dollarsPerEvent}</span>
    </Tooltip>
  );
}

export default OnDemandPrice;
