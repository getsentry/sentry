import codecs
import csv
import enum
from collections.abc import Mapping, Sequence
from typing import Any, BinaryIO

from sentry.utils import json


class OutputMode(str, enum.Enum):
    JSONL = "jsonl"
    CSV = "csv"

    @classmethod
    def supported_values(cls) -> list[str]:
        return [member.value for member in cls]

    @classmethod
    def as_choices(cls) -> tuple[tuple[str, str], ...]:
        return (
            (cls.CSV.value, "csv"),
            (cls.JSONL.value, "jsonl"),
        )

    @classmethod
    def from_value(cls, value: str | None) -> "OutputMode":
        if value == cls.JSONL.value:
            return cls.JSONL
        return cls.CSV


class FileWriter:
    def __init__(
        self,
        buffer: BinaryIO,
        output_mode: OutputMode = OutputMode.CSV,
        csv_headers: list[str] | None = None,
        **kwargs: Any,
    ) -> None:
        self.output_mode = output_mode
        self._buffer = buffer
        self._config = kwargs
        self._csv_headers = csv_headers
        self._writer: csv.DictWriter[str] | None = None

    def _get_csv_writer(self) -> csv.DictWriter[str]:
        if self._writer is None:
            if self._csv_headers is None:
                raise ValueError("csv_headers are required for CSV exports")
            tfw = codecs.getwriter("utf-8")(self._buffer)
            self._writer = csv.DictWriter(tfw, self._csv_headers, **self._config)
        return self._writer

    def writeheader(self) -> None:
        # Headers are only meaningful for CSV.
        if self.output_mode == OutputMode.CSV:
            writer = self._get_csv_writer()
            writer.writeheader()

    def writerow(self, row: Mapping[str, Any]) -> None:
        if self.output_mode == OutputMode.JSONL:
            self._buffer.write(json.dumps(row).encode("utf-8"))
            self._buffer.write(b"\n")
            return

        writer = self._get_csv_writer()
        writer.writerow(row)

    def writerows(self, rows: Sequence[Mapping[str, Any]]) -> None:
        for row in rows:
            self.writerow(row)


def get_file_type(output_mode: OutputMode) -> str:
    if output_mode == OutputMode.JSONL:
        return "export.jsonl"
    return "export.csv"


def get_content_type(output_mode: OutputMode) -> str:
    if output_mode == OutputMode.JSONL:
        return "application/x-ndjson"
    return "text/csv"


def get_file_extension(output_mode: OutputMode) -> str:
    if output_mode == OutputMode.JSONL:
        return "jsonl"
    return "csv"
