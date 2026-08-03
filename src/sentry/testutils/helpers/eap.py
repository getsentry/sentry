from __future__ import annotations

from collections.abc import Mapping, MutableMapping
from typing import Any

from django.http import QueryDict
from rest_framework.test import APIClient

from sentry.search.eap.constants import EAP_FULL_FIDELITY_QUERY_DAYS, FULL_RETENTION_ITEM_TYPES
from sentry.snuba.utils import DATASET_OPTIONS, RPC_DATASETS

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
_EAP_DATASET_LABELS = frozenset(
    label for label, dataset in DATASET_OPTIONS.items() if dataset in RPC_DATASETS
)

# Paths that hit EAP even without dataset/itemType (or default to an EAP dataset).
_EAP_PATH_FRAGMENTS = (
    "/trace-items/",
    "/ai-conversations/",
    "/spans/fields/",
    "/traces/",
)

# Methods where Django puts the query string in ``data`` rather than the body.
_QUERY_DATA_METHODS = frozenset({"GET", "HEAD", "OPTIONS", "TRACE"})


def is_eap_dataset(dataset: str | None) -> bool:
    return dataset is not None and dataset in _EAP_DATASET_LABELS


def _dataset_from_query(query: Mapping[str, Any]) -> str | None:
    for key in ("dataset", "itemType", "item_type"):
        value = query.get(key)
        if value is None:
            continue
        if isinstance(value, (list, tuple)):
            return value[0] if value else None
        return value
    return None


def _should_apply_default(query: Mapping[str, Any], path: str | None) -> bool:
    if any(key in query for key in _WINDOW_KEYS):
        return False

    dataset = _dataset_from_query(query)
    if dataset is not None and dataset in _FULL_RETENTION_DATASETS:
        return False
    if dataset is not None and dataset in _EAP_DATASET_LABELS:
        return True
    if path is None:
        return False
    return any(fragment in path for fragment in _EAP_PATH_FRAGMENTS)


def _set_default_stats_period(query: MutableMapping[str, Any], path: str | None) -> None:
    if _should_apply_default(query, path):
        query["statsPeriod"] = EAP_DEFAULT_STATS_PERIOD


def apply_eap_default_stats_period(query: Any, *, path: str | None = None) -> Any:
    """Default EAP requests to a window that Snuba won't downsample."""
    if isinstance(query, str):
        params = QueryDict(query, mutable=True)
        _set_default_stats_period(params, path)
        return params.urlencode()

    if isinstance(query, MutableMapping):
        _set_default_stats_period(query, path)
        return query

    if isinstance(query, Mapping):
        params_dict: dict[str, Any] = dict(query)
        _set_default_stats_period(params_dict, path)
        return params_dict

    return query


class EAPClient(APIClient):
    """API client that defaults EAP queries to the full-fidelity window."""

    def generic(self, method: str, path: Any, data: Any = "", *args: Any, **extra: Any) -> Any:
        if str(method).upper() in _QUERY_DATA_METHODS and data not in ("", None):
            data = apply_eap_default_stats_period(data, path=str(path))

        if "query_params" in extra and extra["query_params"] is not None:
            extra["query_params"] = apply_eap_default_stats_period(
                extra["query_params"], path=str(path)
            )

        query_string = extra.get("QUERY_STRING")
        if isinstance(query_string, str):
            extra["QUERY_STRING"] = apply_eap_default_stats_period(query_string, path=str(path))

        return super().generic(method, path, data, *args, **extra)
