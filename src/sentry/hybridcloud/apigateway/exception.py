class Retryable(Exception):
    def __init__(self, original: BaseException) -> None:
        super().__init__(str(original))
        self.original = original
