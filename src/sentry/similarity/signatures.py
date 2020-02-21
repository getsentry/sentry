from __future__ import absolute_import

import mmh3
from sentry.utils.compat import map


class MinHashSignatureBuilder(object):
    def __init__(self, columns, rows):
        self.columns = columns
        self.rows = rows

    def __call__(self, features):
        return list(map(
            lambda column: min(
                [mmh3.hash(feature, column) % self.rows for feature in features]
            ),
            range(self.columns),
        ))
