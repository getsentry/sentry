import csv

from django.http import StreamingHttpResponse


# csv.writer doesn't provide a non-file interface
# https://docs.djangoproject.com/en/1.9/howto/outputting-csv/#streaming-large-csv-files
class Echo:
    def write(self, value):
        return value


class CsvMixin:
    def get_header(self, **kwargs):
        return ()

    def get_row(self, item, **kwargs):
        return ()

    def to_csv_response(self, iterable, filename, **kwargs):
        def row_iter():
            header = self.get_header(**kwargs)
            if header:
                yield header
            for item in iterable:
                yield self.get_row(item, **kwargs)

        pseudo_buffer = Echo()
        writer = csv.writer(pseudo_buffer)
        response = StreamingHttpResponse(
            (writer.writerow(r) for r in row_iter()), content_type="text/csv"
        )
        response["Content-Disposition"] = f'attachment; filename="{filename}.csv"'
        return response
