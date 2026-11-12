from __future__ import annotations

from collections.abc import Callable

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.types import SnubaParams
from sentry.telemetry_classifiers.datasets.conversations import compile_conversation_filter
from sentry.telemetry_classifiers.types import Dataset

_FILTER_COMPILERS: dict[str, Callable[[str, SnubaParams], str]] = {
    Dataset.CONVERSATION: compile_conversation_filter,
}


def compile_filter(dataset: str, filter_query: str, snuba_params: SnubaParams) -> str:
    """Compile a classifier filter for its dataset. Raises InvalidSearchQuery."""
    compiler = _FILTER_COMPILERS.get(dataset)
    if compiler is None:
        raise InvalidSearchQuery("Filters aren't supported for this dataset yet.")
    return compiler(filter_query, snuba_params)
