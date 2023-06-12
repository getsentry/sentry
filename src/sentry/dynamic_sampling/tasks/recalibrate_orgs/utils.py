from typing import Optional

from sentry import quotas
from sentry.dynamic_sampling.recalibrate_transactions import OrganizationDataVolume
from sentry.dynamic_sampling.rules.utils import (
    adjusted_factor,
    generate_cache_key_rebalance_factor,
    get_redis_client_for_ds,
)

# MIN and MAX rebalance factor ( make sure we don't go crazy when rebalancing)
MIN_REBALANCE_FACTOR = 0.1
MAX_REBALANCE_FACTOR = 10


def rebalance_org(org_volume: OrganizationDataVolume) -> Optional[str]:
    """
    Calculates the rebalancing factor for an org

    It takes the last interval total number of transactions and kept transactions, and
    it figures out how far it is from the desired rate ( i.e. the blended rate)
    """
    redis_client = get_redis_client_for_ds()
    factor_key = generate_cache_key_rebalance_factor(org_volume.org_id)

    desired_sample_rate = quotas.get_blended_sample_rate(organization_id=org_volume.org_id)
    if desired_sample_rate is None:
        return f"Organisation with desired_sample_rate==None org_id={org_volume.org_id}"

    if org_volume.total == 0 or org_volume.indexed == 0:
        # not enough info to make adjustments ( we don't consider this an error)
        return None

    previous_interval_sample_rate = org_volume.indexed / org_volume.total
    try:
        previous_factor = float(redis_client.get(factor_key))
    except (TypeError, ValueError):
        previous_factor = 1.0

    new_factor = adjusted_factor(
        previous_factor, previous_interval_sample_rate, desired_sample_rate
    )

    if new_factor < MIN_REBALANCE_FACTOR or new_factor > MAX_REBALANCE_FACTOR:
        # whatever we did before didn't help, give up
        redis_client.delete(factor_key)
        return f"factor:{new_factor} outside of the acceptable range [{MIN_REBALANCE_FACTOR}..{MAX_REBALANCE_FACTOR}]"

    if new_factor != 1.0:
        # Finally got a good key, save it to be used in rule generation
        redis_client.set(factor_key, new_factor)
    else:
        # we are either at 1.0 no point creating an adjustment rule
        redis_client.delete(factor_key)

    return None
