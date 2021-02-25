import mmh3


class MinHashSignatureBuilder:
    def __init__(self, columns, rows):
        self.columns = columns
        self.rows = rows

    def __call__(self, features):
        return map(
            lambda column: min(
                map(lambda feature: mmh3.hash(feature, column) % self.rows, features)
            ),
            range(self.columns),
        )
