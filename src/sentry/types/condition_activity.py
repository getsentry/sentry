from __future__ import annotations

from dataclasses import dataclass, field
from datetime import datetime, timedelta
from enum import Enum
from typing import Any, Dict, Sequence

from sentry.snuba.dataset import Dataset
from sentry.snuba.events import Column

FREQUENCY_CONDITION_BUCKET_SIZE = timedelta(minutes=5)


class ConditionActivityType(Enum):
    CREATE_ISSUE = 0
    REGRESSION = 1
    REAPPEARED = 2


@dataclass
class ConditionActivity:
    group_id: str
    type: ConditionActivityType
    timestamp: datetime
    data: Dict[str, Any] = field(default_factory=dict)


# Map of supported datasets for preview
DATASET_TO_COLUMN_NAME = {
    Dataset.Events: "event_name",
    Dataset.Transactions: "transaction_name",
}


def get_dataset_columns(columns: Sequence[Column]) -> Dict[Dataset, Sequence[str]]:
    """
    Given a list of Column Enum objects, return their actual column name in each dataset that is supported
    """
    dataset_columns = {}
    for dataset, column_name in DATASET_TO_COLUMN_NAME.items():
        dataset_columns[dataset] = [
            getattr(column.value, column_name)
            for column in columns
            if getattr(column.value, column_name) is not None
        ]

    return dataset_columns
