from sentry import options
from sentry.dynamic_sampling.rules.utils import get_redis_client_for_ds

# In case a misconfiguration happens on the server side which makes the option invalid, we want to define a fallback
# sliding window size, which in this case will be 24 hours.
FALLBACK_SLIDING_WINDOW_SIZE = 24
# We want to keep the entry for 1 hour, so that in case an org is not considered for 1 hour, the system will fall back
# to the blended sample rate.
# Important: this TTL should be a factor of the cron schedule for dynamic-sampling-sliding-window/-org located in
# sentry.conf.server.py.
EXECUTED_CACHE_KEY_TTL = 60 * 60 * 1000


def generate_sliding_window_org_executed_cache_key() -> str:
    return "ds::sliding_window_org_executed"


def mark_sliding_window_org_executed() -> None:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_org_executed_cache_key()

    redis_client.set(cache_key, 1)
    redis_client.pexpire(cache_key, EXECUTED_CACHE_KEY_TTL)


def was_sliding_window_org_executed() -> bool:
    redis_client = get_redis_client_for_ds()
    cache_key = generate_sliding_window_org_executed_cache_key()

    return bool(redis_client.exists(cache_key))


def generate_sliding_window_org_cache_key(org_id: int) -> str:
    return f"ds::o:{org_id}:sliding_window_org_sample_rate"


def get_sliding_window_size() -> int | None:
    try:
        size = options.get("dynamic-sampling:sliding_window.size")
        # We want to explicitly handle the None case, which will signal that the system should be stopped.
        return None if size is None else int(size)
    except ValueError:
        # In case the value set is invalid, we will fallback to a default value, to keep the system up and running.
        return FALLBACK_SLIDING_WINDOW_SIZE
