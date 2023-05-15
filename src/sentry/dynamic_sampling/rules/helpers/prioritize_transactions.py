from typing import List, Mapping, Tuple, cast

import sentry_sdk

from sentry.dynamic_sampling.models.utils import DSElement
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds
from sentry.utils import json


def _get_cache_key(org_id: int, proj_id: int) -> str:
    return f"ds::o:{org_id}:p:{proj_id}:pri_tran"


def get_transactions_resampling_rates(
    org_id: int, proj_id: int, default_rate: float
) -> Tuple[Mapping[str, float], float]:
    redis_client = get_redis_client_for_ds()
    cache_key = _get_cache_key(org_id=org_id, proj_id=proj_id)
    try:
        serialised_val = redis_client.get(cache_key)
        if serialised_val:
            val = json.loads(serialised_val)
            ret_val = cast(Tuple[Mapping[str, float], float], val)
            return ret_val
    except (TypeError, ValueError) as e:
        sentry_sdk.capture_exception(e)

    return {}, default_rate


def set_transactions_resampling_rates(
    org_id: int, proj_id: int, named_rates: List[DSElement], default_rate: float, ttl_ms: int
) -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = _get_cache_key(org_id=org_id, proj_id=proj_id)
    named_rates_dict = {rate.id: rate.new_sample_rate for rate in named_rates}
    val = [named_rates_dict, default_rate]
    val_str = json.dumps(val)
    redis_client.set(cache_key, val_str)
    redis_client.pexpire(cache_key, ttl_ms)
