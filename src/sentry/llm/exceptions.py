class InvalidUsecaseError(ValueError):
    pass


class InvalidProviderError(ValueError):
    pass


class InvalidModelError(ValueError):
    pass


class InvalidTemperature(ValueError):
    pass


class VertexRequestFailed(RuntimeError):
    status_code: int
    message: str

    def __init__(self, status_code, message):
        super().__init__(self.message)
        self.status_code = status_code
        self.message = message
