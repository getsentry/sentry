import mmh3


class MinHashSignatureBuilder:
    def __init__(self, columns, rows):
        self.columns = columns
        self.rows = rows

    def __call__(self, features):
        return [
            min(mmh3.hash(feature, column) % self.rows for feature in features)
            for column in range(self.columns)
        ]
