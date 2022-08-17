from collections import namedtuple
from enum import Enum
from typing import Any, Mapping, Sequence

from sentry.sentry_metrics.configuration import UseCaseKey

_COLUMNS = [
    "id",
    "decoded_id",
    "string",
    "organization_id",
    "date_added",
    "last_seen",
    "retention_days",
]

SpannerIndexerModel = namedtuple(
    "SpannerIndexerModel",
    [
        "id",
        "decoded_id",
        "string",
        "organization_id",
        "date_added",
        "last_seen",
        "retention_days",
    ],
)

DATABASE_PARAMETERS: Mapping[UseCaseKey, Mapping[str, str]] = {
    UseCaseKey.PERFORMANCE: {
        "table_name": "perfstringindexer",
        "unique_organization_string_index_name": "unique_organization_string_index",
    },
    UseCaseKey.RELEASE_HEALTH: {
        "table_name": "perfstringindexer",
        "unique_organization_string_index_name": "unique_organization_string_index",
    },
}


def get_column_names() -> Sequence[str]:
    return _COLUMNS


class CloudSpannerInsertMode(Enum):
    """
    The method to use when inserting data into CloudSpanner.
    """

    DML = 1
    MUTATION = 2


class CloudSpannerDBAccessor:
    """
    Provides methods to perform INSERT's and READ's on CloudSpanner.
    """

    def __init__(self, database: Any, table_name: str, insert_mode: CloudSpannerInsertMode) -> None:
        self.__database = database
        self.__table_name = table_name
        self.__insert = (
            self.__insert_using_mutation
            if insert_mode == CloudSpannerInsertMode.MUTATION
            else self.__insert_using_dml
        )

    def __insert_using_dml(self, models: Sequence[SpannerIndexerModel]) -> None:
        """
        Insert data using DML. Raise any errors that occur so that the
        application can handle them.
        """

        def insert_dml(transaction: Any) -> None:
            """
            Inserts data on a database table in a transaction context.
            """
            transaction.insert(self.__table_name, columns=get_column_names(), values=models)

        self.__database.run_in_transaction(insert_dml)

    def __insert_using_mutation(self, models: Sequence[SpannerIndexerModel]) -> None:
        """
        Insert data using Mutation. Raise any errors that occur so that the
        application can handle them.
        """
        with self.__database.batch() as batch:
            batch.insert(
                table=self.__table_name,
                columns=get_column_names(),
                values=models,
            )

    def insert(self, models: Sequence[SpannerIndexerModel]) -> None:
        return self.__insert(models)
