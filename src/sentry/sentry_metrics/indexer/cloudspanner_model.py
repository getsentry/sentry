import datetime
from dataclasses import dataclass
from typing import Sequence

_TIMESTAMP_TZ_FORMAT = "%Y-%m-%d %H:%M:%S %Z"


@dataclass
class SpannerIndexerModel:
    id: int
    string: str
    organization_id: int
    date_added: datetime.datetime
    last_seen: datetime.datetime
    retention_days: int

    def to_values_format_dml(self) -> str:
        """
        Returns a string in the format of (id, string, organization_id,
        date_added, last_seen, retention_days) which can be used in the
        VALUES section of INSERT statement.
        """

        return (
            f'({self.id}, "{self.string}", {self.organization_id},'
            f" '{self.date_added.strftime(_TIMESTAMP_TZ_FORMAT)}', "
            f"'{self.last_seen.strftime(_TIMESTAMP_TZ_FORMAT)}',"
            f" {self.retention_days})"
        )

    @staticmethod
    def to_columns_format_dml() -> str:
        """
        Returns a string which can be used in the COLUMNS section of
        INSERT statement.
        Only useful when you want to insert all columns of the model.
        """
        return "(id, string, organization_id, date_added, " "last_seen, retention_days)"

    @staticmethod
    def to_columns_format_batch() -> Sequence[str]:
        """
        Returns the set of columns which can be used in the columns parameter of
        batch inserts/updates.
        Only useful when you want to insert all columns of the model.
        """
        return ["id", "string", "organization_id", "date_added", "last_seen", "retention_days"]
