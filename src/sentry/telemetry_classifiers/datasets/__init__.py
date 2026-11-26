from __future__ import annotations

from sentry.exceptions import InvalidSearchQuery
from sentry.search.events.types import SnubaParams
from sentry.telemetry_classifiers.datasets.base import ClassifierDataset
from sentry.telemetry_classifiers.datasets.conversations import ConversationDataset
from sentry.telemetry_classifiers.types import Dataset

DATASETS: dict[str, ClassifierDataset] = {
    Dataset.CONVERSATION: ConversationDataset(),
}


def compile_filter(dataset: str, filter_query: str, snuba_params: SnubaParams) -> str:
    """Compile a classifier filter for its dataset. Raises InvalidSearchQuery."""
    classifier_dataset = DATASETS.get(dataset)
    if classifier_dataset is None:
        raise InvalidSearchQuery("Filters aren't supported for this dataset yet.")
    return classifier_dataset.compile_filter(filter_query, snuba_params)
