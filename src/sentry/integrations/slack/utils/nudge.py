import random
from datetime import datetime, timezone

from sentry import features
from sentry.models.organization import Organization
from sentry.utils.cache import cache


def should_send_nudge_block(
    *,
    channel_id: str,
    organization: Organization,
) -> bool:
    if not features.has("organizations:slack-reinstall-nudge-on-issue-alert", organization):
        return False

    # only 10% of the alerts should have the nudge blocks
    if random.random() >= 0.1:
        return False

    iso_year, iso_week, _ = datetime.now(timezone.utc).isocalendar()
    cache_key = f"slack:alert_nudge:{channel_id}:{iso_year}:{iso_week}"

    count = cache.get(cache_key, 0)
    if count >= 4:
        return False

    if count == 0:
        cache.set(cache_key, 1, timeout=7 * 24 * 60 * 60)
    else:
        try:
            cache.incr(cache_key)
        except ValueError:
            # The key may have been evicted/expired between the get and the
            # incr; incr raises ValueError on a missing key, so fall back to set.
            cache.set(cache_key, count + 1, timeout=7 * 24 * 60 * 60)

    return True
