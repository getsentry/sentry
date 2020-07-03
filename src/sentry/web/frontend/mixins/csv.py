from __future__ import absolute_import

import csv
import six

from django.utils.encoding import force_bytes
from django.http import StreamingHttpResponse
from sentry.utils.compat import map

# Python 2 doesn't support unicode with CSV, but Python 3 does via
# the encoding param
if six.PY3:

    def encode_row(row):
        return row


else:

    def encode_row(row):
        return map(force_bytes, row)


# csv.writer doesn't provide a non-file interface
# https://docs.djangoproject.com/en/1.9/howto/outputting-csv/#streaming-large-csv-files
class Echo(object):
    def write(self, value):
        return value


class CsvMixin(object):
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
            (writer.writerow(encode_row(r)) for r in row_iter()), content_type="text/csv"
        )
        response["Content-Disposition"] = u'attachment; filename="{}.csv"'.format(filename)
        return response
