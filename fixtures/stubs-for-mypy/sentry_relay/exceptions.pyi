exceptions_by_code: dict[int, type[Exception]]

class RelayError(Exception):
    code: int | None
    message: str
    rust_info: str | None

class UnpackError(RelayError): ...
class UnpackErrorSignatureExpired(UnpackError): ...
class InvalidReleaseError(RelayError): ...
