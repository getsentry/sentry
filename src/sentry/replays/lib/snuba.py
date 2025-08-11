from collections.abc import Sequence
from typing import Any

import sentry_sdk
from snuba_sdk import Query, Request

from sentry.utils.snuba import RateLimitExceeded, raw_snql_query


def execute_query(
    query: Query,
    tenant_ids: dict[str, int],
    referrer: str,
) -> Sequence[dict[str, Any]]:
    try:
        response = raw_snql_query(
            Request(
                dataset="replays",
                app_id="replay-backend-web",
                query=query,
                tenant_ids=tenant_ids,
            ),
            referrer,
        )
        return response["data"]
    except RateLimitExceeded as exc:
        sentry_sdk.set_tag("replay-rate-limit-exceeded", True)
        sentry_sdk.set_tag("org_id", tenant_ids.get("organization_id"))
        sentry_sdk.set_extra("referrer", referrer)
        sentry_sdk.capture_exception(exc)
        raise
