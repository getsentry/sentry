from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import parse_qsl, urlencode

from django.http import QueryDict
from rest_framework.test import APIClient

from sentry.search.eap.constants import EAP_FULL_FIDELITY_QUERY_DAYS, FULL_RETENTION_ITEM_TYPES

__all__ = [
    "EAP_DEFAULT_STATS_PERIOD",
    "SentryAPIClient",
    "apply_eap_default_stats_period",
    "is_eap_dataset",
]

# Snuba's OutcomesBasedRoutingStrategy routes any EAP query whose window starts more
# than 31 days ago to the TIER_8 downsampled table. Test fixtures are only written to
# the tier 1 table; the downsampled tables are populated by a materialized view that
# keeps roughly 1 in 8 items (``cityHash64(item_id + 8) % 8 = 0``), so a query that
# gets downsampled sees an arbitrary subset of the items a test just stored.
#
# The API defaults to a 90 day window when no ``statsPeriod``/``start``/``end`` is
# given (``sentry.api.utils.MAX_STATS_PERIOD``), which is past that boundary. Tests
# that don't care about the window should use EAP's full-fidelity window instead.
#
# ``SentryAPIClient`` (wired as the default test API client) applies this automatically
# so individual tests don't need to remember. Opt out by setting an explicit window key.
EAP_DEFAULT_STATS_PERIOD = f"{EAP_FULL_FIDELITY_QUERY_DAYS}d"

# Keys that pin down the query window. If a test sets any of these it has opted into a
# specific window and we must not override it.
_WINDOW_KEYS = frozenset(
    {
        "statsPeriod",
        "statsPeriodStart",
        "statsPeriodEnd",
        "start",
        "end",
        "range",
        # The trace endpoints derive a narrow window around a single event/trace.
        "timestamp",
    }
)


# ``dataset`` / ``itemType`` query param labels for the item types Snuba keeps at full
# retention, whose queries are never downsampled no matter how far back the window
# starts. ``preprod`` is spelled ``preprodSize`` as a dataset label.
_FULL_RETENTION_DATASETS = frozenset(
    {item_type.value for item_type in FULL_RETENTION_ITEM_TYPES} | {"preprodSize"}
)

# URL path fragments that always hit EAP (or default to an EAP dataset). Used when a
# request doesn't pass ``dataset``/``itemType`` but still needs the tier-1 window —
# e.g. trace-item stats defaults to spans, ai-conversations always queries spans.
_EAP_PATH_FRAGMENTS = (
    "/trace-items/",
    "/ai-conversations/",
    "/spans/fields/",
    # OrganizationTracesEndpoint defaults dataset to spans.
    "/traces/",
)


def _eap_dataset_labels() -> frozenset[str]:
    """Labels in the ``dataset``/``itemType`` query params that resolve to EAP."""
    from sentry.snuba.utils import DATASET_OPTIONS, RPC_DATASETS

    return frozenset(label for label, dataset in DATASET_OPTIONS.items() if dataset in RPC_DATASETS)


def is_eap_dataset(dataset: str | None) -> bool:
    return dataset is not None and dataset in _eap_dataset_labels()


def _is_full_retention_dataset(dataset: str | None) -> bool:
    return dataset is not None and dataset in _FULL_RETENTION_DATASETS


def _dataset_from_query(query: Mapping[str, Any]) -> str | None:
    for key in ("dataset", "itemType", "item_type"):
        value = query.get(key)
        if value is None:
            continue
        # QueryDict/MultiValueDict may return a list for multi-valued keys.
        if isinstance(value, (list, tuple)):
            return value[0] if value else None
        return value
    return None


def _is_eap_path(path: str | None) -> bool:
    if not path:
        return False
    return any(fragment in path for fragment in _EAP_PATH_FRAGMENTS)


def _should_apply_default(query: Mapping[str, Any], path: str | None) -> bool:
    if any(key in query for key in _WINDOW_KEYS):
        return False

    dataset = _dataset_from_query(query)
    if _is_full_retention_dataset(dataset):
        return False

    if is_eap_dataset(dataset):
        return True

    # Path-only EAP endpoints (no dataset/itemType, or an unrecognized value that the
    # endpoint will default) still need the tier-1 window.
    return _is_eap_path(path)


def apply_eap_default_stats_period(query: Any, *, path: str | None = None) -> Any:
    """Default EAP requests to a window that Snuba won't downsample.

    Applies when the request targets a downsampled EAP dataset (via ``dataset``/
    ``itemType``) or an EAP-only path, and doesn't already pin the window down.
    See ``EAP_DEFAULT_STATS_PERIOD`` for why.

    Mutates mapping-like inputs in place. Encoded query strings are re-encoded.
    """
    if isinstance(query, str):
        # Django accepts a pre-encoded query string as ``data``.
        params = QueryDict(query, mutable=True)
        if _should_apply_default(params, path):
            params["statsPeriod"] = EAP_DEFAULT_STATS_PERIOD
        return params.urlencode()

    if not isinstance(query, MutableMapping):
        return query

    if _should_apply_default(query, path):
        query["statsPeriod"] = EAP_DEFAULT_STATS_PERIOD
    return query


def _apply_to_query_string(query_string: str, *, path: str | None) -> str:
    params = dict(parse_qsl(query_string, keep_blank_values=True))
    apply_eap_default_stats_period(params, path=path)
    return urlencode(params)


class SentryAPIClient(APIClient):
    """DRF API client that keeps EAP test queries inside the full-fidelity window.

    Individual tests should not need to set ``statsPeriod`` for EAP datasets unless
    they intentionally want a different window.
    """

    def get(self, path: str, data=None, follow: bool = False, **extra):
        if data is not None:
            data = apply_eap_default_stats_period(data, path=path)
        if "QUERY_STRING" in extra and isinstance(extra["QUERY_STRING"], str):
            extra["QUERY_STRING"] = _apply_to_query_string(extra["QUERY_STRING"], path=path)
        return super().get(path, data=data, follow=follow, **extra)
