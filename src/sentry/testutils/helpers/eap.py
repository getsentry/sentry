from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import Any
from urllib.parse import parse_qsl, urlencode

from django.http import QueryDict
from rest_framework.test import APIClient

from sentry.search.eap.constants import EAP_FULL_FIDELITY_QUERY_DAYS, FULL_RETENTION_ITEM_TYPES

__all__ = [
    "EAP_DEFAULT_STATS_PERIOD",
    "EAPClient",
    "apply_eap_default_stats_period",
    "is_eap_dataset",
]

# Snuba downsamples EAP queries whose window starts >31d ago. Test fixtures only land
# in tier 1, so the API's 90d default would make tests see an arbitrary subset of rows.
# EAPClient applies this automatically; set an explicit window key to opt out.
EAP_DEFAULT_STATS_PERIOD = f"{EAP_FULL_FIDELITY_QUERY_DAYS}d"

_WINDOW_KEYS = frozenset(
    {
        "statsPeriod",
        "statsPeriodStart",
        "statsPeriodEnd",
        "start",
        "end",
        "range",
        "timestamp",
    }
)

# preprod is spelled preprodSize as a dataset label.
_FULL_RETENTION_DATASETS = frozenset(
    {item_type.value for item_type in FULL_RETENTION_ITEM_TYPES} | {"preprodSize"}
)

# Paths that hit EAP even without dataset/itemType (or default to an EAP dataset).
_EAP_PATH_FRAGMENTS = (
    "/trace-items/",
    "/ai-conversations/",
    "/spans/fields/",
    "/traces/",
)


def _eap_dataset_labels() -> frozenset[str]:
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
    return _is_eap_path(path)


def apply_eap_default_stats_period(query: Any, *, path: str | None = None) -> Any:
    """Default EAP requests to a window that Snuba won't downsample."""
    if isinstance(query, str):
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


class EAPClient(APIClient):
    """API client that defaults EAP queries to the full-fidelity window."""

    def get(self, path: str, data=None, follow: bool = False, **extra):
        if data is not None:
            data = apply_eap_default_stats_period(data, path=path)
        if "QUERY_STRING" in extra and isinstance(extra["QUERY_STRING"], str):
            extra["QUERY_STRING"] = _apply_to_query_string(extra["QUERY_STRING"], path=path)
        return super().get(path, data=data, follow=follow, **extra)
