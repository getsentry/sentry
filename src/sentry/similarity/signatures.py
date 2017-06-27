from __future__ import absolute_import

import mmh3


class MinHashSignatureBuilder(object):
    def __init__(self, bands, buckets, rows):
        self.bands = bands
        self.buckets = buckets
        self.rows = rows

    def __call__(self, features):
        return map(
            lambda band: map(
                lambda bucket: min(
                    map(
                        lambda feature: mmh3.hash(
                            feature,
                            bucket,
                        ) % self.rows,
                        features,
                    ),
                ),
                range(
                    self.buckets * band,
                    self.buckets * (band + 1),
                ),
            ),
            range(self.bands),
        )
