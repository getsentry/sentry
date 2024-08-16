from __future__ import annotations

import csv
from collections.abc import Generator, Iterable
from typing import Generic, TypeVar

from django.http import StreamingHttpResponse

T = TypeVar("T")


# csv.writer doesn't provide a non-file interface
# https://docs.djangoproject.com/en/1.9/howto/outputting-csv/#streaming-large-csv-files
class Echo:
    def write(self, value: str) -> str:
        return value


class CsvResponder(Generic[T]):
    def get_header(self) -> tuple[str, ...]:
        raise NotImplementedError

    def get_row(self, item: T) -> tuple[str, ...]:
        raise NotImplementedError

    def respond(self, iterable: Iterable[T], filename: str) -> StreamingHttpResponse:
        def row_iter() -> Generator[tuple[str, ...]]:
            header = self.get_header()
            if header:
                yield header
            for item in iterable:
                yield self.get_row(item)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        return StreamingHttpResponse(
            (writer.writerow(r) for r in row_iter()),
            content_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="{filename}.csv"'},
        )
