from __future__ import annotations

from collections.abc import MutableMapping
from typing import Any

from sentry.search.eap.constants import EAP_FULL_FIDELITY_QUERY_DAYS, FULL_RETENTION_ITEM_TYPES

__all__ = [
    "EAP_DEFAULT_STATS_PERIOD",
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


# ``dataset`` query param labels for the item types Snuba keeps at full retention, whose
# queries are never downsampled no matter how far back the window starts. ``preprod`` is
# spelled ``preprodSize`` as a dataset label.
_FULL_RETENTION_DATASETS = frozenset(
    {item_type.value for item_type in FULL_RETENTION_ITEM_TYPES} | {"preprodSize"}
)


def _eap_dataset_labels() -> frozenset[str]:
    """Labels in the ``dataset`` query param that resolve to a downsampled EAP dataset."""
    from sentry.snuba.utils import DATASET_OPTIONS, RPC_DATASETS

    return frozenset(
        label
        for label, dataset in DATASET_OPTIONS.items()
        if dataset in RPC_DATASETS and label not in _FULL_RETENTION_DATASETS
    )


def is_eap_dataset(dataset: str | None) -> bool:
    return dataset is not None and dataset in _eap_dataset_labels()


def apply_eap_default_stats_period(query: Any) -> Any:
    """Default EAP requests to a window that Snuba won't downsample.

    Only applies when the request targets an EAP dataset and doesn't already pin the
    window down. See ``EAP_DEFAULT_STATS_PERIOD`` for why.
    """
    if not isinstance(query, MutableMapping):
        return query
    if not is_eap_dataset(query.get("dataset")):
        return query
    if any(key in query for key in _WINDOW_KEYS):
        return query

    query["statsPeriod"] = EAP_DEFAULT_STATS_PERIOD
    return query
